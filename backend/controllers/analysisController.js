const Analysis = require('../models/Analysis');
const DataIssue = require('../models/DataIssue');
const Recommendation = require('../models/Recommendation');
const { generateFingerprint } = require('./fingerprintController');
const { runRules } = require('../utils/ruleEngine');
const { ConsistencyResult } = require('../models/ConsistencyModels');
const { recordSnapshot } = require('./integrityController');
const { computeAndSave: saveForensics } = require('./forensicsController');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const xlsx = require('xlsx');
const xml2js = require('xml2js');

async function runAndSaveConsistency(analysisId, rows) {
  try {
    const result = runRules(rows);
    await ConsistencyResult.create({
      analysisId,
      totalRows: result.totalRows,
      flaggedCount: result.flaggedCount,
      consistencyScore: result.consistencyScore,
      ruleSummary: result.ruleSummary,
      flaggedRows: result.flaggedRows.slice(0, 500),
    });
  } catch (_) {}
}

const EMPTY_VALUES = new Set(['', 'null', 'none', 'n/a', 'na', 'undefined', '-', '--', 'nil', 'missing', 'nan']);
const isEmpty = (val) => val === null || val === undefined || EMPTY_VALUES.has(String(val).trim().toLowerCase());

function isValidDate(val) {
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/) || s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const [y, mo, d] = s.includes('-') ? [+m[1], +m[2], +m[3]] : [+m[3], +m[2], +m[1]];
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

function isCellInvalid(val, colL) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (colL.includes('email') && !emailRegex.test(String(val).trim())) return true;
  if ((colL.includes('date') || colL.includes('dob')) && !isValidDate(val)) return true;
  if (colL.includes('phone') && !/^\+?[\d\s\-()]{7,15}$/.test(String(val).trim())) return true;
  if ((colL.includes('amount') || colL.includes('price') || colL.includes('total')) && (isNaN(parseFloat(val)) || parseFloat(val) < 0)) return true;
  return false;
}

function calculateScores(data) {
  const totalRows = data.length;
  if (totalRows === 0) return { completeness: 0, uniqueness: 0, validity: 0, consistency: 0, overallScore: 0, problemRowPct: 0 };

  const columns = Object.keys(data[0]);
  const totalCells = totalRows * columns.length;

  // Completeness = (NonNullValues / TotalValues) × 100
  let filledCells = 0;
  data.forEach(row => columns.forEach(col => { if (!isEmpty(row[col])) filledCells++; }));
  const completeness = Math.round((filledCells / totalCells) * 100);

  // Uniqueness = (UniqueRecords / TotalRecords) × 100
  const uniqueRows = new Set(data.map(row => JSON.stringify(row))).size;
  const uniqueness = Math.round((uniqueRows / totalRows) * 100);

  // Validity = (ValidEntries / TotalEntries) × 100
  // ValidEntries = cells that are non-empty AND pass format validation
  let validEntries = 0;
  data.forEach(row => {
    columns.forEach(col => {
      const val = row[col];
      if (!isEmpty(val) && !isCellInvalid(val, col.toLowerCase())) validEntries++;
    });
  });
  const validity = Math.round((validEntries / Math.max(filledCells, 1)) * 100);

  // Consistency = (ConsistentRecords / TotalRecords) × 100
  // A record is consistent if all its columns have uniform expected types
  let inconsistentCols = 0;
  columns.forEach(col => {
    const nonEmpty = data.map(row => row[col]).filter(v => !isEmpty(v));
    if (nonEmpty.length === 0) { inconsistentCols++; return; }
    const types = new Set(nonEmpty.map(v => isNaN(v) ? 'string' : 'number'));
    if (types.size > 1) inconsistentCols++;
  });
  const consistency = Math.round(((columns.length - inconsistentCols) / Math.max(columns.length, 1)) * 100);

  // Problem Rows% = (RowsWithIssues / TotalRows) × 100
  // Includes: rows with missing/invalid cells + duplicate rows
  const seen = new Set();
  const dupRowIndices = new Set();
  data.forEach((row, idx) => {
    const k = JSON.stringify(row);
    if (seen.has(k)) dupRowIndices.add(idx);
    else seen.add(k);
  });
  const problemRows = data.filter((row, idx) =>
    dupRowIndices.has(idx) ||
    columns.some(col => isEmpty(row[col]) || isCellInvalid(row[col], col.toLowerCase()))
  ).length;
  const problemRowPct = Math.round((problemRows / totalRows) * 100);

  // Weighted Score (w1=0.3, w2=0.2, w3=0.3, w4=0.2)
  const weightedScore = (completeness * 0.3) + (uniqueness * 0.2) + (validity * 0.3) + (consistency * 0.2);

  // Final Adjusted Score = WeightedScore − (ProblemRows% × PenaltyFactor)
  const penaltyFactor = 0.3;
  const overallScore = Math.max(0, Math.round(weightedScore - (problemRowPct * penaltyFactor)));

  return { completeness, uniqueness, validity, consistency, overallScore, problemRowPct };
}

async function detectAndSaveIssues(analysisId, data) {
  const issues = [];
  const totalRows = data.length;
  if (totalRows === 0) return;

  const columns = Object.keys(data[0]);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Missing values per column
  columns.forEach(col => {
    const missing = data.filter(row => isEmpty(row[col])).length;
    if (missing > 0) {
      const pct = Math.round((missing / totalRows) * 100);
      issues.push({ analysisId, issueType: 'Missing',
        severity: pct > 30 ? 'Critical' : pct > 15 ? 'High' : pct > 5 ? 'Medium' : 'Low',
        description: `${missing} rows have missing values in column "${col}" (${pct}%)`,
        affectedRows: missing, column: col });
    }
  });

  // Duplicates
  const seen = new Set(); let duplicates = 0;
  data.forEach(row => { const k = JSON.stringify(row); if (seen.has(k)) duplicates++; else seen.add(k); });
  if (duplicates > 0) {
    issues.push({ analysisId, issueType: 'Duplicate',
      severity: duplicates > totalRows * 0.2 ? 'Critical' : duplicates > totalRows * 0.1 ? 'High' : 'Medium',
      description: `${duplicates} duplicate rows detected`, affectedRows: duplicates, column: 'all' });
  }

  // Invalid emails
  columns.filter(c => c.toLowerCase().includes('email')).forEach(col => {
    const invalid = data.filter(row => !isEmpty(row[col]) && !emailRegex.test(String(row[col]).trim())).length;
    if (invalid > 0) issues.push({ analysisId, issueType: 'Invalid',
      severity: invalid > 10 ? 'High' : 'Medium',
      description: `${invalid} invalid email addresses in column "${col}"`, affectedRows: invalid, column: col });
  });

  // Invalid dates
  columns.filter(c => c.toLowerCase().includes('date') || c.toLowerCase().includes('dob')).forEach(col => {
    const invalid = data.filter(row => !isEmpty(row[col]) && !isValidDate(row[col])).length;
    if (invalid > 0) issues.push({ analysisId, issueType: 'Invalid',
      severity: invalid > 5 ? 'High' : 'Medium',
      description: `${invalid} invalid dates in column "${col}"`, affectedRows: invalid, column: col });
  });

  // Invalid phones
  columns.filter(c => c.toLowerCase().includes('phone')).forEach(col => {
    const invalid = data.filter(row => !isEmpty(row[col]) && !/^\+?[\d\s\-()]{7,15}$/.test(String(row[col]).trim())).length;
    if (invalid > 0) issues.push({ analysisId, issueType: 'Invalid',
      severity: 'Medium',
      description: `${invalid} invalid phone numbers in column "${col}"`, affectedRows: invalid, column: col });
  });

  // Negative or NaN amounts
  columns.filter(c => c.toLowerCase().includes('amount') || c.toLowerCase().includes('price') || c.toLowerCase().includes('total')).forEach(col => {
    const invalid = data.filter(row => { const n = parseFloat(row[col]); return !isEmpty(row[col]) && (isNaN(n) || n < 0); }).length;
    if (invalid > 0) issues.push({ analysisId, issueType: 'Invalid',
      severity: 'High',
      description: `${invalid} invalid values (negative or NaN) in column "${col}"`, affectedRows: invalid, column: col });
  });

  if (issues.length > 0) await DataIssue.bulkCreate(issues);
}

function parseSql(content) {
  const rows = [];
  const insertRe = /INSERT\s+INTO\s+[`"']?\w+[`"']?\s*\(([^)]+)\)\s*VALUES\s*(.+?)(?=;|INSERT|$)/gis;
  let match;
  while ((match = insertRe.exec(content)) !== null) {
    const cols = match[1].split(',').map(c => c.trim().replace(/[`"']/g, ''));
    const valuesBlock = match[2];
    const rowRe = /\(([^)]+)\)/g;
    let rowMatch;
    while ((rowMatch = rowRe.exec(valuesBlock)) !== null) {
      const vals = rowMatch[1].split(',').map(v => v.trim().replace(/^['"](.*)['"]$/, '$1'));
      const row = {};
      cols.forEach((c, i) => { row[c] = vals[i] ?? ''; });
      rows.push(row);
    }
  }
  if (rows.length === 0) throw new Error('No INSERT INTO statements found in SQL file');
  return rows;
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function parseGoogleSheet(url) {
  // Convert any Google Sheets URL to CSV export URL
  const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error('Invalid Google Sheets URL');
  const id = idMatch[1];
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  const buf = await fetchUrl(exportUrl);
  const tmpPath = `uploads/gs_${Date.now()}.csv`;
  fs.writeFileSync(tmpPath, buf);
  const rows = await parseFile(tmpPath, 'sheet.csv');
  fs.unlinkSync(tmpPath);
  return rows;
}

async function parseFile(filePath, originalName, sheetName = null) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.csv' || ext === '.tsv') {
    return new Promise((resolve, reject) => {
      const rows = [];
      const separator = ext === '.tsv' ? '\t' : ',';
      fs.createReadStream(filePath)
        .pipe(csv({ separator }))
        .on('data', d => rows.push(d))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  if (ext === '.xlsx' || ext === '.xls' || ext === '.ods') {
    const wb = xlsx.readFile(filePath);
    const targetSheet = sheetName && wb.SheetNames.includes(sheetName)
      ? sheetName
      : wb.SheetNames[0];
    const ws = wb.Sheets[targetSheet];
    return xlsx.utils.sheet_to_json(ws, { defval: '' });
  }

  if (ext === '.json' || ext === '.ndjson') {
    const text = fs.readFileSync(filePath, 'utf8').trim();
    // NDJSON: one JSON object per line
    if (ext === '.ndjson' || text.startsWith('{')) {
      const lines = text.split('\n').filter(l => l.trim());
      const parsed = lines.map(l => JSON.parse(l));
      if (Array.isArray(parsed[0])) return parsed.flat();
      return parsed;
    }
    const raw = JSON.parse(text);
    if (Array.isArray(raw)) return raw;
    const arrKey = Object.keys(raw).find(k => Array.isArray(raw[k]));
    if (arrKey) return raw[arrKey];
    throw new Error('JSON must contain an array of records');
  }

  if (ext === '.xml') {
    const xml = fs.readFileSync(filePath, 'utf8');
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });
    // Find the first array of objects inside the root
    const root = parsed[Object.keys(parsed)[0]];
    const arrKey = Object.keys(root).find(k => Array.isArray(root[k]));
    if (!arrKey) throw new Error('XML must contain a repeated element (list of records)');
    return root[arrKey].map(item =>
      typeof item === 'object' ? item : { value: item }
    );
  }

  if (ext === '.sql') {
    const content = fs.readFileSync(filePath, 'utf8');
    return parseSql(content);
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

// Returns sheet names + row count preview for Excel/ODS files
exports.getSheets = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!['.xlsx', '.xls', '.ods'].includes(ext)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Sheet selection only applies to Excel/ODS files' });
  }
  try {
    const wb = xlsx.readFile(req.file.path);
    const sheets = wb.SheetNames.map(name => {
      const ws = wb.Sheets[name];
      const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { name, rowCount: rows.length, columnCount: columns.length, columns: columns.slice(0, 8) };
    });
    // Keep file on disk temporarily — client will reference it by tempId
    const tempId = path.basename(req.file.path);
    res.json({ tempId, fileName: req.file.originalname, sheets });
  } catch (err) {
    fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file && !req.body.tempId) return res.status(400).json({ error: 'No file uploaded' });

    // If client is re-using a pre-uploaded temp file (sheet selection flow)
    let filePath, originalName, fileSize;
    if (req.body.tempId) {
      filePath = path.join('uploads', req.body.tempId);
      originalName = req.body.fileName || 'file.xlsx';
      fileSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
      if (!fs.existsSync(filePath)) return res.status(400).json({ error: 'Temp file expired. Please re-upload.' });
    } else {
      filePath = req.file.path;
      originalName = req.file.originalname;
      fileSize = req.file.size;
    }

    const sheetName = req.body.sheetName || null;
    let results;
    try {
      results = await parseFile(filePath, originalName, sheetName);
    } catch (parseErr) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ error: `Parse error: ${parseErr.message}` });
    }
    // Normalise all values to strings for consistent scoring
    results = results.map(row => {
      const norm = {};
      Object.keys(row).forEach(k => { norm[k] = row[k] === null || row[k] === undefined ? '' : String(row[k]); });
      return norm;
    });
    const displayName = sheetName ? `${originalName} — ${sheetName}` : originalName;
    const scores = calculateScores(results);
    const analysis = await Analysis.create({
      fileName: displayName, fileSize, rowCount: results.length, rawData: results, ...scores
    });
    await detectAndSaveIssues(analysis.id, results);
    await generateFingerprint(analysis.id, displayName, results, filePath);
    await runAndSaveConsistency(analysis.id, results);
    await recordSnapshot(analysis);
    await saveForensics(analysis);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true, fileName: displayName, rowCount: results.length, scores, analysisId: analysis.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.uploadFromUrl = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });
  try {
    let results;
    if (url.includes('docs.google.com/spreadsheets')) {
      results = await parseGoogleSheet(url);
    } else {
      return res.status(400).json({ error: 'Only Google Sheets URLs are supported' });
    }
    results = results.map(row => {
      const norm = {};
      Object.keys(row).forEach(k => { norm[k] = row[k] === null || row[k] === undefined ? '' : String(row[k]); });
      return norm;
    });
    const scores = calculateScores(results);
    const fileName = `Google Sheet (${new Date().toLocaleDateString()})`;
    const analysis = await Analysis.create({
      fileName, fileSize: 0, rowCount: results.length, rawData: results, ...scores
    });
    await detectAndSaveIssues(analysis.id, results);
    await generateFingerprint(analysis.id, fileName, results, null);
    await runAndSaveConsistency(analysis.id, results);
    await recordSnapshot(analysis);
    await saveForensics(analysis);
    res.json({ success: true, fileName, rowCount: results.length, scores, analysisId: analysis.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const history = await Analysis.findAll({ order: [['createdAt', 'DESC']], limit: 20 });
    res.json(history.map(a => ({ ...a.toJSON(), scores: { completeness: a.completeness, uniqueness: a.uniqueness, validity: a.validity, consistency: a.consistency, overallScore: a.overallScore, problemRowPct: a.problemRowPct } })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAnalysisById = async (req, res) => {
  try {
    const analysis = await Analysis.findByPk(req.params.id, { include: [{ model: DataIssue }] });
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    const a = analysis.toJSON();
    res.json({ ...a, scores: { completeness: a.completeness, uniqueness: a.uniqueness, validity: a.validity, consistency: a.consistency, overallScore: a.overallScore, problemRowPct: a.problemRowPct }, rawData: a.rawData || [], issues: a.DataIssues || [], problemRowPct: a.problemRowPct });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const analysis = await Analysis.findByPk(id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    await DataIssue.destroy({ where: { analysisId: id } });
    await Recommendation.destroy({ where: { analysisId: id } });
    await analysis.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.getInsights = (req, res) => {
  const { scores } = req.body;
  const insights = [];
  if (scores.uniqueness < 75) insights.push('Uniqueness score is below 75%. Consider removing duplicate records.');
  if (scores.completeness < 80) insights.push('Completeness needs improvement. Check for missing values.');
  if (scores.validity >= 90) insights.push('Validity score is excellent. Keep maintaining data validation rules.');
  if (scores.overallScore >= 80) insights.push('Overall data quality is good. Focus on improving lower-scoring dimensions.');
  res.json({ insights });
};
