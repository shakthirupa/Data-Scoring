const Analysis = require('../models/Analysis');
const DataIssue = require('../models/DataIssue');
const Recommendation = require('../models/Recommendation');
const { generateFingerprint } = require('./fingerprintController');
const { runRules } = require('../utils/ruleEngine');
const { ConsistencyResult } = require('../models/ConsistencyModels');
const { recordSnapshot } = require('./integrityController');
const { computeAndSave: saveForensics } = require('./forensicsController');
const { getNullableColumns } = require('./settingsController');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const xlsx = require('xlsx');
const xml2js = require('xml2js');
const { PDFParse: _PDFParseClass } = require('pdf-parse');
const parsePdf = (buf) => new _PDFParseClass().parse(buf);
const mammoth  = require('mammoth');
const Tesseract = require('tesseract.js');
const { ocrPdf } = require('../utils/pdfOcr');

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
    // Keep Analysis.consistency in sync with the rule-engine score
    await Analysis.update({ consistency: result.consistencyScore }, { where: { id: analysisId } });
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

function calculateScores(data, nullableCols = []) {
  const nullable = new Set(nullableCols.map(c => c.toLowerCase()));
  const totalRows = data.length;
  if (totalRows === 0) return { completeness: 0, uniqueness: 0, validity: 0, consistency: 0, overallScore: 0, problemRowPct: 0 };

  const columns = Object.keys(data[0]);
  const scoredCols = columns.filter(c => !nullable.has(c.toLowerCase()));
  const totalCells = totalRows * (scoredCols.length || columns.length);

  // Completeness — only non-nullable columns
  let filledCells = 0;
  data.forEach(row => scoredCols.forEach(col => { if (!isEmpty(row[col])) filledCells++; }));
  const completeness = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 100;

  // Uniqueness
  let uniqueness;
  if (totalRows === 1) {
    uniqueness = completeness;
  } else {
    const uniqueRows = new Set(data.map(row => JSON.stringify(row))).size;
    uniqueness = Math.round((uniqueRows / totalRows) * 100);
  }

  // Validity — only non-nullable columns
  let validEntries = 0, filledForValidity = 0;
  data.forEach(row => {
    scoredCols.forEach(col => {
      const val = row[col];
      if (!isEmpty(val)) {
        filledForValidity++;
        if (!isCellInvalid(val, col.toLowerCase())) validEntries++;
      }
    });
  });
  const validity = Math.round((validEntries / Math.max(filledForValidity, 1)) * 100);

  // Consistency — all columns
  let inconsistentCols = 0;
  columns.forEach(col => {
    const nonEmpty = data.map(row => row[col]).filter(v => !isEmpty(v));
    if (nonEmpty.length === 0) { inconsistentCols++; return; }
    const types = new Set(nonEmpty.map(v => isNaN(v) ? 'string' : 'number'));
    if (types.size > 1) inconsistentCols++;
  });
  const consistency = Math.round(((columns.length - inconsistentCols) / Math.max(columns.length, 1)) * 100);

  // Problem rows — skip nullable columns for missing-value check
  const seen = new Set();
  const dupRowIndices = new Set();
  if (totalRows > 1) {
    data.forEach((row, idx) => {
      const k = JSON.stringify(row);
      if (seen.has(k)) dupRowIndices.add(idx);
      else seen.add(k);
    });
  }
  const problemRows = data.filter((row, idx) =>
    dupRowIndices.has(idx) ||
    scoredCols.some(col => isEmpty(row[col]) || isCellInvalid(row[col], col.toLowerCase()))
  ).length;
  const problemRowPct = Math.round((problemRows / totalRows) * 100);

  const weightedScore = (completeness * 0.3) + (uniqueness * 0.2) + (validity * 0.3) + (consistency * 0.2);
  const overallScore = Math.max(0, Math.round(weightedScore - (problemRowPct * 0.3)));

  return { completeness, uniqueness, validity, consistency, overallScore, problemRowPct };
}

async function detectAndSaveIssues(analysisId, data, nullableCols = []) {
  const nullable = new Set(nullableCols.map(c => c.toLowerCase()));
  const issues = [];
  const totalRows = data.length;
  if (totalRows === 0) return;

  const columns = Object.keys(data[0]);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Missing values — skip nullable columns
  columns.filter(col => !nullable.has(col.toLowerCase())).forEach(col => {
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

// ── Label-aware field extractor ─────────────────────────────────────────────
// Maps known label synonyms to canonical field names + their value patterns.
// Scans the text for "<label> <separator> <value>" and also for values that
// appear on the line immediately after a label-only line.
const FIELD_PATTERNS = [
  {
    field: 'aadhaar',
    labels: /aadhaar|aadhar|adhaar|adhar|uid|unique\s*id(?:entification)?|identity\s*no?|id\s*no?/i,
    value: /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/,
    clean: v => v.replace(/[\s-]/g, ''),
  },
  {
    field: 'pan',
    labels: /pan|permanent\s*account\s*no?|income\s*tax\s*id/i,
    value: /\b([A-Z]{5}\d{4}[A-Z])\b/,
    clean: v => v,
  },
  {
    field: 'voter_id',
    labels: /voter|epic|election\s*card|voter\s*id/i,
    value: /\b([A-Z]{3}\d{7})\b/,
    clean: v => v,
  },
  {
    field: 'passport',
    labels: /passport/i,
    value: /\b([A-Z]\d{7})\b/,
    clean: v => v,
  },
  {
    field: 'driving_license',
    labels: /driving\s*licen[sc]e|dl\s*no?|licence\s*no?/i,
    value: /\b([A-Z]{2}\d{2}[\s-]?\d{4}[\s-]?\d{7})\b/,
    clean: v => v.replace(/[\s-]/g, ''),
  },
  {
    field: 'phone',
    labels: /phone|mobile|contact|cell|tel(?:ephone)?/i,
    value: /\b(\+?\d[\d\s\-]{8,13}\d)\b/,
    clean: v => v.trim(),
  },
  {
    field: 'email',
    labels: /e?-?mail/i,
    value: /\b([\w.+-]+@[\w-]+\.[\w.]+)\b/,
    clean: v => v,
  },
  {
    field: 'dob',
    labels: /date\s*of\s*birth|dob|birth\s*date/i,
    value: /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/,
    clean: v => v,
  },
  {
    field: 'name',
    labels: /\bname\b|full\s*name|applicant\s*name|student\s*name/i,
    value: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/,
    clean: v => v.trim(),
  },
];

function extractLabeledFields(fullText, record) {
  // Strategy 1: "Label: value" or "Label - value" on the same segment
  for (const fp of FIELD_PATTERNS) {
    if (record[fp.field]) continue;
    // Build a pattern: label synonym followed by optional separator then value
    const re = new RegExp(
      fp.labels.source + '[^\\n]{0,30}?' + fp.value.source,
      'i'
    );
    const m = fullText.match(re);
    if (m) {
      // Extract just the value group (last capture group)
      const valMatch = m[0].match(fp.value);
      if (valMatch) { record[fp.field] = fp.clean(valMatch[1]); continue; }
    }

    // Strategy 2: label on one line, value on the next (common in PDFs)
    const lineRe = new RegExp(
      '(' + fp.labels.source + ')[^\\n]*\\n[^\\n]*?' + fp.value.source,
      'i'
    );
    const lm = fullText.replace(/\r/g, '').match(lineRe);
    if (lm) {
      const valMatch = lm[0].match(fp.value);
      if (valMatch) record[fp.field] = fp.clean(valMatch[1]);
    }
  }

  // Blind fallback for fields not yet found
  if (!record['aadhaar']) {
    const m = fullText.match(/\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/);
    if (m) record['aadhaar'] = m[1].replace(/[\s-]/g, '');
  }
  if (!record['pan']) {
    const m = fullText.match(/\b([A-Z]{5}\d{4}[A-Z])\b/);
    if (m) record['pan'] = m[1];
  }
  if (!record['phone']) {
    const m = fullText.match(/\b(\+?\d[\d\s\-]{8,13}\d)\b/);
    if (m) record['phone'] = m[1].trim();
  }
  if (!record['email']) {
    const m = fullText.match(/\b([\w.+-]+@[\w-]+\.[\w.]+)\b/);
    if (m) record['email'] = m[1];
  }
}

// ── Document text → structured rows ─────────────────────────────────────────
function textToRows(text, fileName) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Pipe-delimited table (e.g. Markdown tables in Word/PDF)
  const pipeLines = lines.filter(l => l.includes('|') && l.split('|').filter(Boolean).length >= 2);
  if (pipeLines.length >= 3) {
    const parsed = pipeLines
      .map(l => l.split('|').map(c => c.trim()).filter(Boolean))
      .filter(r => !r.every(c => /^[-=:]+$/.test(c)));
    if (parsed.length >= 2) {
      const header = parsed[0];
      const rows = parsed.slice(1).map(r => {
        const row = {};
        header.forEach((h, i) => { row[h] = r[i] ?? ''; });
        return row;
      });
      if (rows.length > 0) return rows;
    }
  }

  // 2. Tab/multi-space aligned table (common in PDF exports)
  const tabLines = lines.filter(l => /\t|  {2,}/.test(l));
  if (tabLines.length >= 3) {
    const split = tabLines.map(l => l.split(/\t|  {2,}/).map(c => c.trim()).filter(Boolean));
    const colCount = split[0].length;
    if (colCount >= 2 && split.slice(1).every(r => r.length >= colCount - 1)) {
      const header = split[0];
      const rows = split.slice(1).map(r => {
        const row = {};
        header.forEach((h, i) => { row[h] = r[i] ?? ''; });
        return row;
      });
      if (rows.length > 0) return rows;
    }
  }

  // 3. Repeated key:value blocks separated by blank lines (multi-record docs)
  const rawBlocks = text.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  const kvRe = /^([A-Za-z][\w\s/().-]{1,40})\s*[:\-]\s*(.+)$/;
  const blockRecords = rawBlocks.map(block => {
    const rec = {};
    block.split('\n').forEach(line => {
      const m = line.trim().match(kvRe);
      if (m) rec[m[1].trim().replace(/\s+/g, '_')] = m[2].trim();
    });
    extractLabeledFields(block.replace(/\n/g, ' '), rec);
    return rec;
  }).filter(r => Object.keys(r).length >= 2);

  if (blockRecords.length >= 2) return blockRecords;

  // 4. Single record — extract all key:value pairs from entire text
  const record = {};
  lines.forEach(line => {
    const m = line.match(kvRe);
    if (m) record[m[1].trim().replace(/\s+/g, '_')] = m[2].trim();
  });

  // Pull structured fields — label-aware first, then blind regex fallback
  const fullText = text.replace(/\n/g, ' ');
  extractLabeledFields(fullText, record);

  if (Object.keys(record).length > 0) return [record];

  // 5. Fallback — each non-empty line is a row
  return lines.map(line => ({ text: line, source: fileName }));
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
    const wb = xlsx.readFile(filePath, { cellText: false, cellDates: true });
    const targetSheet = sheetName && wb.SheetNames.includes(sheetName)
      ? sheetName
      : wb.SheetNames[0];
    const ws = wb.Sheets[targetSheet];

    // Try sheet_to_json first — works for clean flat tables
    let rows = xlsx.utils.sheet_to_json(ws, { defval: '', raw: true });

    // If very few rows came back, the sheet likely has merged headers or title rows.
    // Re-parse using raw array mode and find the real header row ourselves.
    if (rows.length < 3) {
      const arr = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
      // Find the first row that has the most non-empty cells — that's the header
      let headerIdx = 0;
      let maxFilled = 0;
      arr.forEach((r, i) => {
        const filled = r.filter(c => c !== '' && c !== null && c !== undefined).length;
        if (filled > maxFilled) { maxFilled = filled; headerIdx = i; }
      });
      const headers = arr[headerIdx].map((h, i) => (h !== '' && h !== null ? String(h).trim() : `col_${i}`))
      rows = arr.slice(headerIdx + 1)
        .filter(r => r.some(c => c !== '' && c !== null && c !== undefined))
        .map(r => {
          const row = {};
          headers.forEach((h, i) => { row[h] = r[i] ?? ''; });
          return row;
        });
    }

    return rows.map(row => {
      const out = {};
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'number' && Number.isFinite(v)) {
          out[k] = Number.isInteger(v) ? String(v) : v.toPrecision(15).replace(/\.?0+$/, '');
        } else {
          out[k] = v === null || v === undefined ? '' : String(v);
        }
      }
      return out;
    });
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

  if (ext === '.pdf') {
    const buf  = fs.readFileSync(filePath);
    const data = await parsePdf(buf);
    const text = data.text.trim();
    if (text.length > 30) return textToRows(text, path.basename(originalName, '.pdf'));
    const ocrText = await ocrPdf(filePath);
    return textToRows(ocrText, path.basename(originalName, '.pdf'));
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return textToRows(result.value, path.basename(originalName, '.docx'));
  }

  if (['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'].includes(ext)) {
    const { ocrImage } = require('../utils/pdfOcr');
    const text = await ocrImage(filePath);
    return textToRows(text, path.basename(originalName, ext));
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
    const wb = xlsx.readFile(req.file.path, { cellText: false, cellDates: true });
    const sheets = wb.SheetNames.map(name => {
      const ws = wb.Sheets[name];
      const rows = xlsx.utils.sheet_to_json(ws, { defval: '', raw: true });
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
    results = results.map(row => {
      const norm = {};
      Object.keys(row).forEach(k => { norm[k] = row[k] === null || row[k] === undefined ? '' : String(row[k]); });
      return norm;
    });
    const nullableCols = await getNullableColumns(req.userId);
    const displayName = sheetName ? `${originalName} — ${sheetName}` : originalName;
    const scores = calculateScores(results, nullableCols);
    const analysis = await Analysis.create({
      fileName: displayName, fileSize, rowCount: results.length, rawData: results, userId: req.userId, ...scores
    });
    await detectAndSaveIssues(analysis.id, results, nullableCols);
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
    const nullableCols = await getNullableColumns(req.userId);
    const scores = calculateScores(results, nullableCols);
    const fileName = `Google Sheet (${new Date().toLocaleDateString()})`;
    const analysis = await Analysis.create({
      fileName, fileSize: 0, rowCount: results.length, rawData: results, userId: req.userId, ...scores
    });
    await detectAndSaveIssues(analysis.id, results, nullableCols);
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
    const where = req.userId ? { userId: req.userId } : {};
    const history = await Analysis.findAll({ where, order: [['createdAt', 'DESC']], limit: 20 });
    res.json(history.map(a => ({ ...a.toJSON(), scores: { completeness: a.completeness, uniqueness: a.uniqueness, validity: a.validity, consistency: a.consistency, overallScore: a.overallScore, problemRowPct: a.problemRowPct } })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAnalysisById = async (req, res) => {
  try {
    const where = req.userId ? { id: req.params.id, userId: req.userId } : { id: req.params.id };
    const analysis = await Analysis.findOne({ where, include: [{ model: DataIssue }] });
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    const a = analysis.toJSON();
    res.json({ ...a, scores: { completeness: a.completeness, uniqueness: a.uniqueness, validity: a.validity, consistency: a.consistency, overallScore: a.overallScore, problemRowPct: a.problemRowPct }, rawData: a.rawData || [], issues: a.DataIssues || [], problemRowPct: a.problemRowPct, verificationStatus: a.verificationStatus || {} });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAllAnalyses = async (req, res) => {
  try {
    const where = req.userId ? { userId: req.userId } : {};
    const analyses = await Analysis.findAll({ where, attributes: ['id'] });
    const ids = analyses.map(a => a.id);
    if (ids.length > 0) {
      await DataIssue.destroy({ where: { analysisId: ids } });
      await Recommendation.destroy({ where: { analysisId: ids } });
      await Analysis.destroy({ where });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAnalysis = async (req, res) => {
  try {
    const { id } = req.params;
    const where = req.userId ? { id, userId: req.userId } : { id };
    const analysis = await Analysis.findOne({ where });
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

exports.saveVerificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus } = req.body;
    const where = req.userId ? { id, userId: req.userId } : { id };
    const analysis = await Analysis.findOne({ where });
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    await analysis.update({ verificationStatus });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.findRelationships = async (req, res) => {
  try {
    const where = req.userId ? { userId: req.userId } : {};
    const analyses = await Analysis.findAll({ where, order: [['createdAt', 'DESC']], limit: 50 });
    if (analyses.length < 2) return res.json({ relationships: [] });

    const normalise = (col) => col.toLowerCase().replace(/[\s_\-\.]+/g, '');

    // Build meta for every dataset — use ALL columns, not just key-like ones
    const meta = analyses.map(a => {
      const rows = a.rawData || [];
      const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
      const colValues = {};
      cols.forEach(col => {
        const vals = rows
          .map(r => String(r[col] ?? '').trim().toLowerCase())
          .filter(v => v && v !== 'null' && v !== 'undefined' && v !== 'n/a');
        if (vals.length > 0) colValues[col] = new Set(vals);
      });
      return { id: a.id, fileName: a.fileName, rowCount: rows.length, cols, colValues };
    });

    const relationships = [];

    for (let i = 0; i < meta.length; i++) {
      for (let j = i + 1; j < meta.length; j++) {
        const a = meta[i];
        const b = meta[j];
        const matches = [];

        for (const colA of a.cols) {
          const valsA = a.colValues[colA];
          if (!valsA || valsA.size < 2) continue;
          const normA = normalise(colA);

          for (const colB of b.cols) {
            const valsB = b.colValues[colB];
            if (!valsB || valsB.size < 2) continue;
            const normB = normalise(colB);

            // 1. Column name similarity
            const exactMatch = normA === normB;
            const partialMatch = normA.length >= 3 && normB.length >= 3 &&
              (normA.includes(normB) || normB.includes(normA));
            const prefixMatch = normA.length >= 4 && normB.length >= 4 &&
              normA.slice(0, 4) === normB.slice(0, 4);
            const nameSimilar = exactMatch || partialMatch || prefixMatch;

            // 2. Value overlap — check how many values from the smaller set exist in the larger
            const [smaller, larger] = valsA.size <= valsB.size ? [valsA, valsB] : [valsB, valsA];
            const overlap = [...smaller].filter(v => larger.has(v)).length;
            const overlapPct = Math.round((overlap / smaller.size) * 100);

            // Accept if: name matches with any overlap, OR high value overlap regardless of name
            if ((nameSimilar && overlapPct >= 1) || overlapPct >= 50) {
              matches.push({
                colA,
                colB,
                overlapPct,
                overlapCount: overlap,
                joinType: exactMatch ? 'INNER JOIN' : 'LEFT JOIN',
              });
            }
          }
        }

        if (matches.length > 0) {
          matches.sort((x, y) => y.overlapPct - x.overlapPct);
          const best = matches[0];
          relationships.push({
            datasetA: { id: a.id, fileName: a.fileName, rowCount: a.rowCount },
            datasetB: { id: b.id, fileName: b.fileName, rowCount: b.rowCount },
            matches: matches.slice(0, 5),
            suggestedJoin: best.joinType,
            confidence: best.overlapPct >= 70 ? 'High' : best.overlapPct >= 30 ? 'Medium' : 'Low',
          });
        }
      }
    }

    // Sort by confidence then overlap
    relationships.sort((a, b) => {
      const order = { High: 0, Medium: 1, Low: 2 };
      return (order[a.confidence] - order[b.confidence]) ||
             (b.matches[0].overlapPct - a.matches[0].overlapPct);
    });

    res.json({ relationships });
  } catch (error) {
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
