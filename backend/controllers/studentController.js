const Student = require('../models/Student');
const Analysis = require('../models/Analysis');
const { Op } = require('sequelize');
const { ocrPdf, ocrImage } = require('../utils/pdfOcr');
const { PDFParse: _PDFParse } = require('pdf-parse');
const parsePdf = (buf) => new _PDFParse().parse(buf);

// Persistent cross-request cache: fileId -> extracted text
// Survives for the lifetime of the Node process so re-runs are instant
const FILE_TEXT_CACHE = new Map();

function aadhaarMatch(text, aadhaar) {
  if (!text || !aadhaar) return false;
  const a = aadhaar.replace(/[\s-]/g, '');
  if (!/^\d{12}$/.test(a)) return false;
  // Normalize whitespace so multi-space/tab OCR artifacts don't break spaced match
  const norm = text.replace(/[\t ]+/g, ' ');
  const spaced = `${a.slice(0,4)} ${a.slice(4,8)} ${a.slice(8,12)}`;
  if (norm.includes(spaced)) return true;
  if (text.includes(a)) return true;
  if ([...text.matchAll(/(\d{12})/g)].some(m => m[1] === a)) return true;
  // Handle OCR splitting number across lines or inserting extra whitespace
  if (text.replace(/\s+/g, '').includes(a)) return true;
  return false;
}

// Extract the actual Aadhaar found in text (for mismatch reporting)
// Prefers the canonical 4-4-4 spaced pattern; avoids phone numbers (10-digit Indian mobiles start 6-9)
function extractAadhaarFromText(text) {
  // Match 4-4-4 pattern with any whitespace (including multiple spaces from OCR)
  const spaced = text.match(/(\d{4}[\s-]+\d{4}[\s-]+\d{4})/);
  if (spaced) return spaced[1].replace(/[\s-]/g, '');
  // Fall back to solid 12-digit number
  const allTwelve = [...text.matchAll(/(\d{12})/g)].map(m => m[1]);
  return allTwelve[0] || null;
}

function panMatch(text, pan) {
  if (!text || !pan) return false;
  return text.toUpperCase().includes(pan.toUpperCase());
}

function phoneMatch(text, phone) {
  if (!text || !phone) return false;
  const p = phone.replace(/[^\d]/g, '');
  // Reject values that are clearly dates (8 digits or less) not phone numbers
  if (p.length < 10) return false;
  return text.replace(/[^\d]/g, '').includes(p);
}

function nameMatch(text, name) {
  if (!text || !name) return false;
  const words = name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return false;
  const tl = text.toLowerCase();
  // Standard: enough individual words present
  const matched = words.filter(w => tl.includes(w)).length;
  if (matched >= Math.ceil(words.length * 0.6)) return true;
  // Fallback: concatenated name appears in text (handles "BHARANIPRASANTH" vs "BHARANI PRASANTH")
  const concat = words.join('');
  if (tl.replace(/\s+/g, '').includes(concat)) return true;
  // Reverse: text words concatenated contains the name words concatenated
  const textConcat = tl.replace(/\s+/g, '');
  return textConcat.includes(concat);
}

// Build checks object — numbers are STRICT (any mismatch = false), name is lenient
// Returns { checks, matchPct, verified, mismatchedNumbers }
function buildChecks(text, s) {
  const checks = {};
  const mismatchedNumbers = [];
  const textLen = text.length;
  const lowOcr = textLen > 0 && textLen < 200; // very short = OCR likely failed

  if (s.aadhaar) {
    checks.aadhaar = aadhaarMatch(text, s.aadhaar);
    if (!checks.aadhaar) {
      const found = extractAadhaarFromText(text);
      mismatchedNumbers.push({
        field: 'aadhaar',
        expected: s.aadhaar,
        found: found || 'not found',
        lowOcr,
        textLen,
      });
    }
  }
  if (s.pan) {
    checks.pan = panMatch(text, s.pan);
    if (!checks.pan) {
      const found = text.toUpperCase().match(/([A-Z]{5}\d{4}[A-Z])/)?.[1] || 'not found';
      mismatchedNumbers.push({ field: 'pan', expected: s.pan, found, lowOcr, textLen });
    }
  }
  if (s.phone && s.phone.replace(/[^\d]/g, '').length >= 10) {
    checks.phone = phoneMatch(text, s.phone);
    if (!checks.phone) mismatchedNumbers.push({ field: 'phone', expected: s.phone, found: 'not found', lowOcr, textLen });
  }

  const total   = Object.keys(checks).length;
  const matched = Object.values(checks).filter(Boolean).length;
  const matchPct = total > 0 ? Math.round((matched / total) * 100) : 0;

  // Any number mismatch = not verified, regardless of other fields
  const verified = total > 0 && mismatchedNumbers.length === 0 && matched >= Math.ceil(total * 0.6);

  return { checks, matchPct, verified, mismatchedNumbers };
}

function extractFromRow(row) {
  const get = (...names) => {
    for (const n of names) {
      const k = Object.keys(row).find(k => k.toLowerCase().includes(n));
      if (k && row[k] && String(row[k]).trim()) return String(row[k]).trim();
    }
    return null;
  };
  const fullText = Object.values(row).map(v => String(v || '')).join(' ');

  // Extract Aadhaar: column name match first, then any 12-digit number in the row
  const aadhaarCol = get('aadhaar', 'aadhar', 'uid');
  const aadhaarScan = fullText.match(/\b(\d{4}\s?\d{4}\s?\d{4})\b/);
  const aadhaar = aadhaarCol
    ? aadhaarCol.replace(/[\s-]/g, '')
    : aadhaarScan ? aadhaarScan[1].replace(/\s/g, '') : null;

  // Extract roll number: column name match first, then REC.NO pattern in column headers
  let rollNumber = get('roll', 'rollno', 'roll_no', 'enrollment', 'reg');
  if (!rollNumber) {
    // Student profile Excels store roll in column header like "REC.NO :727723euci027"
    const recNoKey = Object.keys(row).find(k => /rec\.?no/i.test(k));
    if (recNoKey) {
      const m = recNoKey.match(/([A-Z0-9]{10,})/i);
      if (m) rollNumber = m[1].toUpperCase();
    }
    // Also scan full text for roll-number pattern
    if (!rollNumber) {
      const rollScan = fullText.match(/\b(\d{6}[A-Z]{4}\d{3})\b/i);
      if (rollScan) rollNumber = rollScan[1].toUpperCase();
    }
  }

  // Extract name: column name match first, then "Name:XXXX" pattern in cell values
  let name = get('name', 'student', 'full_name', 'fullname');
  if (!name || /department/i.test(name)) {
    // Student profile PDFs/Excels have "Name: C.N Gunathmika Chandraleka" as a cell value
    const nameCell = fullText.match(/Name\s*:\s*([A-Za-z][A-Za-z\s.]{2,50})(?=Roll|Reg|Date|\n|$)/i);
    if (nameCell) name = nameCell[1].trim();
  }
  // Reject department/college names as student names
  if (name && /department|college|engineering|technology|mtech|m\.tech/i.test(name)) name = null;
  // Normalise "C.N Gunathmika Chandraleka" -> strip leading initials for storage


  const panMatch   = fullText.match(/\b([A-Z]{5}\d{4}[A-Z])\b/);
  const phoneMatch = fullText.match(/\b(\+?[6-9]\d{9}|\+91\d{10})\b/);
  const dlMatch    = fullText.match(/\b([A-Z]{2}\d{2}\s?\d{4}\s?\d{7}|[A-Z]{2}-\d{2}-\d{4}-\d{7})\b/i);

  return {
    rollNumber: rollNumber || null,
    name:       name || null,
    aadhaar:    aadhaar || null,
    phone:      get('phone', 'mobile', 'contact', 'tel') || (phoneMatch ? phoneMatch[1] : null),
    pan:        get('pan', 'pan_no', 'pancard') || (panMatch ? panMatch[1] : null),
    dlNumber:   get('dl', 'driving', 'licence', 'license', 'dl_no') || (dlMatch ? dlMatch[1] : null),
  };
}

// GET /api/students/folder-structure?folderId=xxx
// Returns the full structure of a Drive folder for debugging
exports.folderStructure = async (req, res) => {
  const { folderId } = req.query;
  if (!folderId) return res.status(400).json({ error: 'folderId is required' });

  const { google } = require('googleapis');
  const fs = require('fs');

  function getAuth() {
    const email   = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').replace(/"/g, '').trim();
    const rawKey  = (process.env.GOOGLE_PRIVATE_KEY || '').trim();
    const keyFile = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').trim();
    if (keyFile && fs.existsSync(keyFile))
      return new google.auth.GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    if (email && rawKey)
      return new google.auth.GoogleAuth({ credentials: { client_email: email, private_key: rawKey.replace(/\\n/g, '\n') }, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    return null;
  }

  const auth = getAuth();
  if (!auth) return res.status(503).json({ error: 'Google Drive not configured' });

  async function buildTree(drive, id, depth = 0) {
    if (depth > 3) return [];
    const resp = await drive.files.list({
      q: `'${id}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType)',
      pageSize: 50,
    });
    const items = [];
    for (const f of resp.data.files || []) {
      const node = { id: f.id, name: f.name, type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file', mimeType: f.mimeType };
      if (node.type === 'folder') node.children = await buildTree(drive, f.id, depth + 1);
      items.push(node);
    }
    return items;
  }

  try {
    const drive = google.drive({ version: 'v3', auth });
    const root  = await drive.files.get({ fileId: folderId, fields: 'id,name,mimeType' });
    const tree  = await buildTree(drive, folderId);
    res.json({ id: folderId, name: root.data.name, children: tree });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/students/verify-drive-stream
exports.verifyAgainstDriveStream = async (req, res) => {
  const { folderId, refresh } = req.query;
  if (!folderId) { res.status(400).json({ error: 'folderId is required' }); return; }

  // If refresh=true, wipe the persistent cache so files are re-downloaded
  if (refresh === 'true') FILE_TEXT_CACHE.clear();

  const { google } = require('googleapis');
  const fs        = require('fs');
  const path      = require('path');

  const mammoth   = require('mammoth');

  function getAuth() {
    const email   = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').replace(/"/g, '').trim();
    const rawKey  = (process.env.GOOGLE_PRIVATE_KEY || '').trim();
    const keyFile = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').trim();
    if (keyFile && fs.existsSync(keyFile))
      return new google.auth.GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    if (email && rawKey)
      return new google.auth.GoogleAuth({ credentials: { client_email: email, private_key: rawKey.replace(/\\n/g, '\n') }, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    return null;
  }

  const auth = getAuth();
  if (!auth) { res.status(503).json({ error: 'Google Drive not configured' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let clientGone = false;
  req.on('close', () => { clientGone = true; });
  const send = (data) => { if (!res.writableEnded && !clientGone) res.write(`data: ${JSON.stringify(data)}\n\n`); };

  const EXT_MAP = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls',
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
    'image/bmp': '.bmp', 'image/tiff': '.tiff',
  };
  const SUPPORTED = new Set(Object.keys(EXT_MAP));

  function extractExcelText(filePath) {
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(filePath, { cellText: false, cellDates: true });
    const parts = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      for (const row of rows) {
        for (const val of Object.values(row)) {
          if (val !== undefined && val !== null && val !== '') parts.push(String(val));
        }
      }
    }
    return parts.join(' ');
  }

  // FILE_TEXT_CACHE is module-level — persists across requests so re-runs skip download+OCR
  async function extractText(drive, fileId, mimeType) {
    if (FILE_TEXT_CACHE.has(fileId)) return FILE_TEXT_CACHE.get(fileId);
    if (FILE_TEXT_CACHE.has(fileId + '_promise')) return FILE_TEXT_CACHE.get(fileId + '_promise');
    const promise = (async () => {
      const ext = EXT_MAP[mimeType];
      const uid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const tmp = path.join('uploads', `verify_${uid}${ext}`);
      try {
        let downloaded = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const axios = require('axios');
            const authClient = await drive.context._options.auth.getClient();
            const token = await authClient.getAccessToken();
            const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            const resp = await axios.get(url, {
              responseType: 'stream', timeout: 30000,
              headers: { Authorization: `Bearer ${token.token}` },
              maxRedirects: 5,
            });
            await new Promise((resolve, reject) => {
              const dest = fs.createWriteStream(tmp);
              resp.data.pipe(dest);
              dest.on('finish', resolve);
              dest.on('error', (e) => { dest.destroy(); reject(e); });
              resp.data.on('error', (e) => { dest.destroy(); reject(e); });
            });
            downloaded = true;
            break;
          } catch (e) {
            try { fs.unlinkSync(tmp); } catch {}
            if (attempt === 3) throw e;
            await new Promise(r => setTimeout(r, attempt * 1000));
          }
        }
        if (!downloaded) return '';
        let text = '';
        if (ext === '.pdf') {
          const d = await parsePdf(fs.readFileSync(tmp));
          text = d.text.trim();
          if (text.length <= 30) text = await ocrPdf(tmp);
        } else if (ext === '.docx') {
          const d = await mammoth.extractRawText({ path: tmp }); text = d.value;
        } else if (ext === '.xlsx' || ext === '.xls') {
          text = extractExcelText(tmp);
        } else {
          text = await ocrImage(tmp);
        }
        FILE_TEXT_CACHE.set(fileId, text);
        return text;
      } catch (e) {
        console.error(`[extractText] failed:`, e.message);
        return '';
      } finally {
        FILE_TEXT_CACHE.delete(fileId + '_promise');
        try { fs.unlinkSync(tmp); } catch {}
      }
    })();
    FILE_TEXT_CACHE.set(fileId + '_promise', promise);
    return promise;
  }

  async function getFilesInFolder(drive, id) {
    const resp = await drive.files.list({
      q: `'${id}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType)',
      pageSize: 200,
    });
    const files = [];
    for (const f of resp.data.files || []) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        files.push(...await getFilesInFolder(drive, f.id));
      } else if (SUPPORTED.has(f.mimeType)) {
        files.push(f);
      }
    }
    return files;
  }

  function matchScore(folderName, student, folderCombinedText = '') {
    const fn = folderName.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (student.rollNumber) {
      const roll = student.rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (fn === roll) return 100;
      if (fn.includes(roll) || roll.includes(fn)) return 100;
      // partial suffix match (last 6+ chars of roll number)
      if (roll.length >= 6 && fn.includes(roll.slice(-6))) return 90;
      // partial prefix match
      if (roll.length >= 6 && fn.includes(roll.slice(0, 6))) return 85;
      // any 5+ char substring of roll found in folder name
      for (let len = Math.min(roll.length, 8); len >= 5; len--) {
        for (let start = 0; start <= roll.length - len; start++) {
          if (fn.includes(roll.slice(start, start + len))) return 70;
        }
      }
    }

    if (student.name) {
      const words = student.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const matched = words.filter(w => fn.includes(w)).length;
      if (words.length > 0 && matched === words.length) return 60;
      if (matched >= Math.ceil(words.length * 0.6) && matched > 0) return 45;
      if (matched > 0) return matched * 15;
    }

    // Last resort: Aadhaar or PAN found inside the folder's documents
    if (folderCombinedText) {
      if (student.aadhaar && aadhaarMatch(folderCombinedText, student.aadhaar)) return 55;
      if (student.pan && panMatch(folderCombinedText, student.pan)) return 50;
    }

    return 0;
  }

  try {
    const drive = google.drive({ version: 'v3', auth });

    send({ type: 'status', message: 'Scanning Drive folder structure...' });
    // List ALL direct children (folders and files) so we can see the structure
    const resp = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType)',
      pageSize: 200,
    });
    if (clientGone) return;

    const allChildren  = resp.data.files || [];
    const driveFolders = allChildren.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const rootFiles    = allChildren.filter(f => f.mimeType !== 'application/vnd.google-apps.folder' && SUPPORTED.has(f.mimeType));

    send({ type: 'status', message: `Found ${driveFolders.length} subfolder(s) and ${rootFiles.length} direct file(s) in Drive` });

    const students = await Student.findAll();
    // Only reset unverified students — already-verified are skipped unless refresh=true
    if (refresh === 'true') {
      await Student.update({ verified: false, verifyResult: null }, { where: {} });
    } else {
      await Student.update({ verified: false, verifyResult: null }, { where: { verified: false } });
    }
    const toVerify = refresh === 'true' ? students : students.filter(s => !s.verified);
    send({ type: 'total', total: students.length, toVerify: toVerify.length, skipped: students.length - toVerify.length });
    if (toVerify.length === 0) { send({ type: 'done' }); return; }

    // Pre-fetch all folder file lists in parallel, extract all text in parallel, then match
    send({ type: 'status', message: 'Downloading and extracting all documents in parallel...' });
    // Build a flat map of ALL folders (not just direct children) with their names
    // so matchScore can find students even in deeply nested zip-extracted structures
    const allFolderNames = new Map(); // folderId -> best name to match against
    async function collectAllFolders(parentId, depth = 0) {
      if (depth > 5) return;
      const r = await drive.files.list({
        q: `'${parentId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id,name)', pageSize: 200,
      });
      const children = r.data.files || [];
      children.forEach(f => allFolderNames.set(f.id, f.name));
      // recurse all children in parallel
      await Promise.all(children.map(f => collectAllFolders(f.id, depth + 1)));
    }
    await Promise.all(driveFolders.map(f => { allFolderNames.set(f.id, f.name); return collectAllFolders(f.id); }));

    const folderFilesMap = new Map();
    await Promise.all(driveFolders.map(async f => {
      const files = await getFilesInFolder(drive, f.id);
      folderFilesMap.set(f.id, files);
    }));

    // Collect every unique file across all folders + root, extract all simultaneously
    const allFiles = [...rootFiles];
    for (const files of folderFilesMap.values()) allFiles.push(...files);
    const uniqueFiles = [...new Map(allFiles.map(f => [f.id, f])).values()];
    // Count cache hits to skip already-processed files
    const cached   = uniqueFiles.filter(f => FILE_TEXT_CACHE.has(f.id));
    const uncached = uniqueFiles.filter(f => !FILE_TEXT_CACHE.has(f.id) && !FILE_TEXT_CACHE.has(f.id + '_promise'));
    if (cached.length > 0) send({ type: 'status', message: `${cached.length} file(s) from cache, downloading ${uncached.length} new file(s)...` });
    // Cap concurrency to 4 to avoid CPU/memory thrashing from simultaneous OCR jobs
    const CONCURRENCY = 4;
    for (let i = 0; i < uniqueFiles.length; i += CONCURRENCY) {
      await Promise.all(uniqueFiles.slice(i, i + CONCURRENCY).map(f => extractText(drive, f.id, f.mimeType)));
    }
    send({ type: 'status', message: `Extracted ${uniqueFiles.length} file(s), verifying all students now...` });

    const parentMap = new Map();
    async function buildParentMap(parentId) {
      const r = await drive.files.list({
        q: `'${parentId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id)', pageSize: 200,
      });
      const children = r.data.files || [];
      children.forEach(f => parentMap.set(f.id, parentId));
      await Promise.all(children.map(f => buildParentMap(f.id)));
    }
    await Promise.all(driveFolders.map(f => buildParentMap(f.id)));

    function isDescendant(childId, ancestorId) {
      let cur = childId;
      while (cur) {
        if (cur === ancestorId) return true;
        cur = parentMap.get(cur);
      }
      return false;
    }

    // Build folderTextMap: folderId -> { combinedText, extracted[] } — all from cache, instant
    const folderTextMap = new Map();
    for (const [fid, files] of folderFilesMap.entries()) {
      const extracted = files.map(f => ({ file: f.name, text: FILE_TEXT_CACHE.get(f.id) || '' }));
      folderTextMap.set(fid, { combinedText: extracted.map(e => e.text).join('\n'), extracted });
    }
    const rootExtracted = rootFiles.map(f => ({ file: f.name, text: FILE_TEXT_CACHE.get(f.id) || '', id: f.id, mimeType: f.mimeType }));

    // Auto-create/update students found in Drive folders that are missing from DB
    send({ type: 'status', message: 'Checking for unregistered students in Drive folders...' });
    for (const [fid, fname] of allFolderNames.entries()) {
      // Only process top-level folders (those in folderFilesMap)
      const topId = folderFilesMap.has(fid) ? fid : (() => {
        for (const tid of driveFolders.map(f => f.id)) { if (isDescendant(fid, tid)) return tid; }
        return null;
      })();
      if (!topId) continue;
      // Extract roll number directly from folder name — most reliable identifier
      const rollMatch = fname.match(/\b(\d{6}[A-Z]{4}\d{3})\b/i);
      if (!rollMatch) continue;
      const roll = rollMatch[1].toUpperCase();
      const existing = students.find(s => s.rollNumber && s.rollNumber.toUpperCase() === roll);
      // Get combined text from all files in this folder
      const folderFiles = folderFilesMap.get(topId) || [];
      const combinedFolderText = folderFiles.map(f => FILE_TEXT_CACHE.get(f.id) || '').join('\n');
      const aadhaarInText = extractAadhaarFromText(combinedFolderText);
      const panInText     = combinedFolderText.toUpperCase().match(/\b([A-Z]{5}\d{4}[A-Z])\b/)?.[1] || null;
      const phoneInText   = combinedFolderText.match(/\b([6-9]\d{9})\b/)?.[1] || null;
      const nameInText    = combinedFolderText.match(/Name\s*:\s*([A-Za-z][A-Za-z\s.]{2,50})(?=Roll|Reg|Date|\n)/i)?.[1]?.trim() || null;
      if (existing) {
        // Update missing fields on existing record using data from documents
        const updates = {};
        if (!existing.aadhaar && aadhaarInText) updates.aadhaar = aadhaarInText;
        if (!existing.pan     && panInText)     updates.pan     = panInText;
        if (!existing.phone   && phoneInText)   updates.phone   = phoneInText;
        if (!existing.name    && nameInText)    updates.name    = nameInText;
        if (Object.keys(updates).length) {
          await existing.update(updates);
          Object.assign(existing, updates);
        }
        continue;
      }
      if (!existing) {
        try {
          const newStudent = await Student.create({
            rollNumber: roll,
            name:       nameInText,
            aadhaar:    aadhaarInText,
            pan:        panInText,
            phone:      phoneInText,
            sourceFile: fname,
          });
          students.push(newStudent);
          send({ type: 'status', message: `Auto-registered student from Drive: ${roll} ${nameInText || ''}` });
        } catch (e) { /* duplicate or constraint error — skip */ }
      }
    }

    // Now verify only unverified students (or all if refresh)
    const results = await Promise.all(toVerify.map(async s => {
      if (clientGone) return;
      send({ type: 'checking', id: s.id, name: s.name, rollNumber: s.rollNumber });

      // Match against ALL folders (including nested), map back to top-level for file lookup
      let bestFolderId = null, bestFolderName = null, bestScore = 0;
      for (const [fid, fname] of allFolderNames.entries()) {
        // resolve to top-level folder to get combined text for content-based matching
        const topId = folderFilesMap.has(fid) ? fid : (() => {
          for (const tid of driveFolders.map(f => f.id)) { if (isDescendant(fid, tid)) return tid; }
          return null;
        })();
        const folderText = topId ? (folderTextMap.get(topId)?.combinedText || '') : '';
        const sc = matchScore(fname, s, folderText);
        if (sc > bestScore) { bestScore = sc; bestFolderId = fid; bestFolderName = fname; }
      }
      // Resolve to top-level folder that has files
      if (bestFolderId && !folderFilesMap.has(bestFolderId)) {
        for (const topId of driveFolders.map(f => f.id)) {
          if (isDescendant(bestFolderId, topId)) { bestFolderId = topId; break; }
        }
      }

      // Lower threshold: accept score >= 45 (was > 0, but now we have more granular scores)
      if (!bestFolderId || bestScore < 45) {
        const matchedRootFile = rootExtracted.find(f => {
          const fn = f.file.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (s.rollNumber && fn.includes(s.rollNumber.toLowerCase().replace(/[^a-z0-9]/g, ''))) return true;
          if (s.name) {
            const words = s.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            if (words.length > 0 && words.every(w => fn.includes(w))) return true;
          }
          return false;
        });
        if (matchedRootFile) {
          const text = matchedRootFile.text;
          const { checks, matchPct, verified, mismatchedNumbers } = buildChecks(text, s);
          send({ type: 'result', id: s.id, name: s.name, rollNumber: s.rollNumber, checks, matchPct, verified, mismatchedNumbers, matchedFile: matchedRootFile.file, folderName: null });
          return { id: s.id, verified, verifyResult: { checks, matchPct, mismatchedNumbers, matchedFile: matchedRootFile.file } };
        } else {
          send({ type: 'result', id: s.id, name: s.name, rollNumber: s.rollNumber, checks: {}, matchPct: 0, verified: false, matchedFile: null, folderName: null, note: 'No folder matched' });
          return { id: s.id, verified: false, verifyResult: { checks: {}, matchPct: 0, matchedFile: null, note: 'No matching folder or file found' } };
        }
      }

      const folderData = folderTextMap.get(bestFolderId);
      if (!folderData || !folderData.extracted.length) {
        send({ type: 'result', id: s.id, name: s.name, rollNumber: s.rollNumber, checks: {}, matchPct: 0, verified: false, matchedFile: null, folderName: bestFolderName, note: 'Folder empty' });
        return { id: s.id, verified: false, verifyResult: { checks: {}, matchPct: 0, matchedFile: null, folderName: bestFolderName, note: 'Folder empty' } };
      }

      const { combinedText, extracted } = folderData;

      // If student is missing aadhaar/name (e.g. only has a scanned Aadhaar PDF, no profile),
      // extract from folder documents and update DB so buildChecks has something to check
      if (!s.aadhaar || !s.name) {
        const updates = {};
        const foundAadhaar = extractAadhaarFromText(combinedText);
        const foundPan     = combinedText.toUpperCase().match(/\b([A-Z]{5}\d{4}[A-Z])\b/)?.[1] || null;
        const foundPhone   = combinedText.match(/\b([6-9]\d{9})\b/)?.[1] || null;
        const foundName    = combinedText.match(/Name\s*:\s*([A-Za-z][A-Za-z\s.]{2,50})(?=Roll|Reg|Date|\n)/i)?.[1]?.trim() || null;
        if (!s.aadhaar && foundAadhaar) { updates.aadhaar = foundAadhaar; s.aadhaar = foundAadhaar; }
        if (!s.pan     && foundPan)     { updates.pan     = foundPan;     s.pan     = foundPan; }
        if (!s.phone   && foundPhone)   { updates.phone   = foundPhone;   s.phone   = foundPhone; }
        if (!s.name    && foundName)    { updates.name    = foundName;    s.name    = foundName; }
        if (Object.keys(updates).length) s.update(updates).catch(e => console.error('[verify] field update failed:', e.message));
      }

      const { checks, matchPct, verified, mismatchedNumbers } = buildChecks(combinedText, s);
      // Roll number verified by folder match itself
      if (s.rollNumber && bestFolderName && bestFolderName.toUpperCase().includes(s.rollNumber.toUpperCase())) {
        checks.rollNumber = true;
      }
      const matchedFile = extracted.find(e =>
        aadhaarMatch(e.text, s.aadhaar) ||
        (s.pan && panMatch(e.text, s.pan)) ||
        (s.phone && phoneMatch(e.text, s.phone)) ||
        nameMatch(e.text, s.name)
      );

      send({ type: 'result', id: s.id, name: s.name, rollNumber: s.rollNumber, checks, matchPct, verified, mismatchedNumbers, matchedFile: matchedFile?.file || null, folderName: bestFolderName });
      return { id: s.id, verified, verifyResult: { checks, matchPct, mismatchedNumbers, matchedFile: matchedFile?.file || null, folderName: bestFolderName } };
    }));

    // Save all results to DB in parallel — one update per student (verifyResult differs per row)
    await Promise.all(
      results.filter(Boolean).map(r =>
        Student.update(
          { verified: r.verified, verifyResult: r.verifyResult },
          { where: { id: r.id } }
        ).catch(e => console.error('[verify] db update failed:', e.message))
      )
    );

    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }
};

// POST /api/students/verify-row
// Verifies a single dataset row against documents in a Drive folder.
// Body: { row: {name, rollNumber, aadhaar, pan, ...}, folderId: string }
exports.verifyRow = async (req, res) => {
  const { row, folderId } = req.body;
  if (!row || !folderId) return res.status(400).json({ error: 'row and folderId are required' });

  const { google } = require('googleapis');
  const fs        = require('fs');
  const path      = require('path');

  const mammoth   = require('mammoth');

  function getAuth() {
    const email   = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').replace(/"/g, '').trim();
    const rawKey  = (process.env.GOOGLE_PRIVATE_KEY || '').trim();
    const keyFile = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').trim();
    if (keyFile && fs.existsSync(keyFile))
      return new google.auth.GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    if (email && rawKey)
      return new google.auth.GoogleAuth({ credentials: { client_email: email, private_key: rawKey.replace(/\\n/g, '\n') }, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    return null;
  }

  const auth = getAuth();
  if (!auth) return res.status(503).json({ error: 'Google Drive not configured' });

  const EXT_MAP = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls',
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
    'image/bmp': '.bmp', 'image/tiff': '.tiff',
  };
  const GOOGLE_EXPORT = {
    'application/vnd.google-apps.document':     'text/plain',
    'application/vnd.google-apps.presentation': 'text/plain',
    'application/vnd.google-apps.spreadsheet':  'text/csv',
  };

  function extractExcelText(filePath) {
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(filePath, { cellText: false, cellDates: true });
    const parts = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      for (const row of rows) {
        for (const val of Object.values(row)) {
          if (val !== undefined && val !== null && val !== '') parts.push(String(val));
        }
      }
    }
    return parts.join(' ');
  }

  async function downloadWithRetry(drive, fileId, tmp, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Get a short-lived download URL then fetch with axios (handles Drive redirects for images)
        const axios = require('axios');
        const tokenRes = await drive.getClient ? null : null;
        const authClient = await drive.context._options.auth.getClient();
        const token = await authClient.getAccessToken();
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const resp = await axios.get(url, {
          responseType: 'stream',
          timeout: 30000,
          headers: { Authorization: `Bearer ${token.token}` },
          maxRedirects: 5,
        });
        await new Promise((resolve, reject) => {
          const dest = fs.createWriteStream(tmp);
          resp.data.pipe(dest);
          dest.on('finish', resolve);
          dest.on('error', (e) => { dest.destroy(); reject(e); });
          resp.data.on('error', (e) => { dest.destroy(); reject(e); });
        });
        return;
      } catch (e) {
        try { fs.unlinkSync(tmp); } catch {}
        if (attempt === retries) throw e;
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }

  async function extractText(drive, fileId, mimeType) {
    try {
      if (GOOGLE_EXPORT[mimeType]) {
        const res = await drive.files.export(
          { fileId, mimeType: GOOGLE_EXPORT[mimeType] },
          { responseType: 'text' }
        );
        return String(res.data || '');
      }
      const ext = EXT_MAP[mimeType];
      if (!ext) return '';
      const tmp = path.join('uploads', `verify_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
      await downloadWithRetry(drive, fileId, tmp);
      try {
        if (ext === '.pdf') {
          const d = await parsePdf(fs.readFileSync(tmp));
          const text = d.text.trim();
          if (text.length > 30) return text;
          return await ocrPdf(tmp);
        }
        if (ext === '.docx') { const d = await mammoth.extractRawText({ path: tmp }); return d.value; }
        if (ext === '.xlsx' || ext === '.xls') return extractExcelText(tmp);
        return await ocrImage(tmp);
      } finally { try { fs.unlinkSync(tmp); } catch {} }
    } catch (e) {
      console.error(`extractText failed for ${fileId} (${mimeType}):`, e.message);
      return '';
    }
  }

  async function getFilesInFolder(drive, id) {
    const resp = await drive.files.list({
      q: `'${id}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType)', pageSize: 200,
    });
    const files = [];
    for (const f of resp.data.files || []) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        files.push(...await getFilesInFolder(drive, f.id));
      } else if (EXT_MAP[f.mimeType] || GOOGLE_EXPORT[f.mimeType]) {
        files.push(f);
      }
    }
    return files;
  }

  // Extract name/roll from the row using the same logic as extractFromRow
  const get = (...names) => {
    for (const n of names) {
      const k = Object.keys(row).find(k => k.toLowerCase().includes(n));
      if (k && row[k] && String(row[k]).trim()) return String(row[k]).trim();
    }
    return null;
  };
  const rowName    = get('name', 'student', 'full_name', 'fullname');
  const rowRoll    = get('roll', 'rollno', 'roll_no', 'enrollment', 'reg');

  // Aadhaar: try column name first, then scan ALL values for 12-digit number
  const rowAadhaar = get('aadhaar', 'aadhar', 'uid') ||
    Object.values(row).map(v => String(v || '').trim().replace(/[\s-]/g, '')).find(v => /^\d{12}$/.test(v)) || null;

  // PAN: try column name first, then scan ALL values
  const rowPan = get('pan', 'pan_no', 'pancard') ||
    Object.values(row).map(v => String(v || '').trim()).find(v => /^[A-Z]{5}\d{4}[A-Z]$/i.test(v)) || null;

  if (!rowName && !rowRoll) return res.status(400).json({ error: 'Row has no name or roll number to match against' });

  try {
    const drive = google.drive({ version: 'v3', auth });

    // List subfolders in the given folder
    const resp = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id,name)', pageSize: 200,
    });
    const subfolders = resp.data.files || [];

    // Score each subfolder against this row
    function score(folderName) {
      const fn = folderName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (rowRoll) {
        const roll = rowRoll.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (fn === roll) return 100;
        if (fn.includes(roll) || roll.includes(fn)) return 100;
        if (roll.length >= 6 && fn.includes(roll.slice(-6))) return 90;
        if (roll.length >= 6 && fn.includes(roll.slice(0, 6))) return 85;
        for (let len = Math.min(roll.length, 8); len >= 5; len--) {
          for (let start = 0; start <= roll.length - len; start++) {
            if (fn.includes(roll.slice(start, start + len))) return 70;
          }
        }
      }
      if (rowName) {
        const words = rowName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const matched = words.filter(w => fn.includes(w)).length;
        if (matched === words.length && words.length > 0) return 60;
        if (matched >= Math.ceil(words.length * 0.6) && matched > 0) return 45;
        if (matched > 0) return matched * 15;
      }
      return 0;
    }

    // If no subfolders, treat the folder itself as the target (flat structure)
    let targetFolderId = folderId;
    let matchedFolderName = null;
    if (subfolders.length > 0) {
      const scored = subfolders.map(f => ({ f, s: score(f.name) })).sort((a, b) => b.s - a.s);
      const best = scored[0];
      if (best.s >= 45) {
        targetFolderId    = best.f.id;
        matchedFolderName = best.f.name;
      } else {
        return res.json({ verified: false, matchPct: 0, checks: {}, note: `No matching subfolder found. Best candidate: "${scored[0]?.f.name}" (score ${best.s}). Roll: ${rowRoll}, Name: ${rowName}` });
      }
    }

    const files = await getFilesInFolder(drive, targetFolderId);
    if (!files.length) return res.json({
      verified: false, matchPct: 0, checks: {},
      note: 'No supported documents found in matched folder',
      folderName: matchedFolderName,
      debug: { rowAadhaar, rowPan, rowName, rowRoll, filesFound: [] }
    });

    const texts = await Promise.all(files.map(f => extractText(drive, f.id, f.mimeType)));
    const combined      = texts.join('\n');
    const combinedClean = combined.replace(/[\s\-]/g, '');  // strip spaces AND dashes
    const combinedLower = combined.toLowerCase();
    const combinedUpper = combined.toUpperCase();

    const checks = {};
    if (rowAadhaar) checks.aadhaar = aadhaarMatch(combined, rowAadhaar);
    if (rowPan)     checks.pan     = panMatch(combined, rowPan);

    // Roll number verified by folder name match — always add if folder was matched by roll
    if (rowRoll && matchedFolderName) {
      const fn   = matchedFolderName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const roll = rowRoll.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (fn.includes(roll) || roll.includes(fn)) checks.rollNumber = true;
    }

    const mismatchedNumbers = [];
    if (checks.aadhaar === false) {
      const found = extractAadhaarFromText(combined);
      // If OCR extracted nothing at all, treat as OCR failure not a mismatch
      const ocrFailed = combined.trim().length < 100;
      mismatchedNumbers.push({ field: 'aadhaar', expected: rowAadhaar, found: found || 'not found', ocrFailed });
    }
    if (checks.pan === false) {
      const found = combined.toUpperCase().match(/([A-Z]{5}\d{4}[A-Z])/)?.[1] || 'not found';
      const ocrFailed = combined.trim().length < 100;
      mismatchedNumbers.push({ field: 'pan', expected: rowPan, found, ocrFailed });
    }

    const total    = Object.keys(checks).length;
    const matched  = Object.values(checks).filter(Boolean).length;
    const matchPct = total > 0 ? Math.round((matched / total) * 100) : 0;
    // verified = all checks pass, or rollNumber matched + no hard mismatches (only OCR failures)
    const hardMismatches = mismatchedNumbers.filter(m => !m.ocrFailed);
    const verified = total > 0 && hardMismatches.length === 0 && matched >= Math.ceil(total * 0.5);

    const foundAadhaar = extractAadhaarFromText(combined);
    const foundPan     = combined.toUpperCase().match(/([A-Z]{5}\d{4}[A-Z])/)?.[1] || null;

    res.json({
      verified, matchPct, checks, mismatchedNumbers,
      folderName: matchedFolderName,
      filesChecked: files.length,
      foundAadhaar,
      foundPan,
      debug: { rowAadhaar, rowPan, rowName, rowRoll, foundAadhaar, foundPan,
        filesFound: files.map(f => ({ name: f.name, mimeType: f.mimeType })),
        textLengths: texts.map((t, i) => ({ name: files[i].name, chars: t.length }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/students/verify-against-drive
exports.verifyAgainstDrive = async (req, res) => {
  const { folderId } = req.body;
  if (!folderId) return res.status(400).json({ error: 'folderId is required' });

  const { google } = require('googleapis');
  const fs        = require('fs');
  const path      = require('path');

  const mammoth   = require('mammoth');

  function getAuth() {
    const email   = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').replace(/"/g, '').trim();
    const rawKey  = (process.env.GOOGLE_PRIVATE_KEY || '').trim();
    const keyFile = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').trim();
    if (keyFile && fs.existsSync(keyFile))
      return new google.auth.GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    if (email && rawKey)
      return new google.auth.GoogleAuth({ credentials: { client_email: email, private_key: rawKey.replace(/\\n/g, '\n') }, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
    return null;
  }

  const auth = getAuth();
  if (!auth) return res.status(503).json({ error: 'Google Drive not configured' });

  try {
    const drive    = google.drive({ version: 'v3', auth });
    const allText  = [];
    const EXT_MAP  = {
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-excel': '.xls',
      'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/bmp': '.bmp', 'image/tiff': '.tiff'
    };
    const SUPPORTED = new Set(Object.keys(EXT_MAP));

    function extractExcelText(filePath) {
      const XLSX = require('xlsx');
      const wb = XLSX.readFile(filePath, { cellText: false, cellDates: true });
      const parts = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        for (const key of Object.keys(ws)) {
          if (key.startsWith('!')) continue;
          const cell = ws[key];
          if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') parts.push(String(cell.v));
        }
      }
      return parts.join(' ');
    }

    async function collectText(id) {
      const resp = await drive.files.list({ q: `'${id}' in parents and trashed=false`, fields: 'files(id,name,mimeType)', pageSize: 200 });
      for (const f of resp.data.files || []) {
        if (f.mimeType === 'application/vnd.google-apps.folder') { await collectText(f.id); continue; }
        if (!SUPPORTED.has(f.mimeType)) continue;
        try {
          const ext = EXT_MAP[f.mimeType];
          const tmp = path.join('uploads', `verify_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
          const dlRes = await drive.files.get({ fileId: f.id, alt: 'media' }, { responseType: 'stream' });
          await new Promise((resolve, reject) => {
            const dest = fs.createWriteStream(tmp);
            dlRes.data.pipe(dest);
            dest.on('finish', resolve);
            dest.on('error', reject);
            dlRes.data.on('error', reject);
          });
          let text = '';
          if (ext === '.xlsx' || ext === '.xls') {
            text = extractExcelText(tmp);
          } else if (ext === '.pdf') {
            const d = await parsePdf(fs.readFileSync(tmp));
            text = d.text.trim();
            if (text.length <= 30) text = await ocrPdf(tmp);
          } else if (ext === '.docx') {
            const d = await mammoth.extractRawText({ path: tmp }); text = d.value;
          } else {
            text = await ocrImage(tmp);
          }
          allText.push({ file: f.name, text });
          try { fs.unlinkSync(tmp); } catch {}
        } catch (_) {}
      }
    }
    await collectText(folderId);

    const combinedText = allText.map(t => t.text).join('\n');
    const students     = await Student.findAll();
    const results      = [];

    for (const s of students) {
      const { checks, matchPct, verified: allMatch, mismatchedNumbers } = buildChecks(combinedText, s);
      const matchedFile = allText.find(t =>
        aadhaarMatch(t.text, s.aadhaar) ||
        (s.pan && panMatch(t.text, s.pan)) ||
        (s.phone && phoneMatch(t.text, s.phone)) ||
        nameMatch(t.text, s.name)
      );
      await s.update({ verified: allMatch, verifyResult: { checks, matchPct, mismatchedNumbers, matchedFile: matchedFile?.file || null } });
      results.push({ id: s.id, name: s.name, rollNumber: s.rollNumber, checks, matchPct, verified: allMatch, mismatchedNumbers, matchedFile: matchedFile?.file || null });
    }

    const verifiedCount = results.filter(r => r.verified).length;
    res.json({ success: true, total: results.length, verified: verifiedCount, failed: results.length - verifiedCount, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/students/extract/:analysisId
exports.extractFromAnalysis = async (req, res) => {
  try {
    const analysis = await Analysis.findByPk(req.params.analysisId);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    const rows = analysis.rawData || [];
    if (!rows.length) return res.status(400).json({ error: 'No data in this analysis' });
    let created = 0, updated = 0, skipped = 0;
    for (const row of rows) {
      const fields = extractFromRow(row);
      if (!fields.name && !fields.rollNumber && !fields.aadhaar) { skipped++; continue; }
      const where = fields.rollNumber ? { rollNumber: fields.rollNumber } : fields.aadhaar ? { aadhaar: fields.aadhaar } : null;
      if (where) {
        const [student, wasCreated] = await Student.findOrCreate({ where, defaults: { ...fields, sourceFile: analysis.fileName, analysisId: analysis.id } });
        if (!wasCreated) {
          const updates = {};
          for (const [k, v] of Object.entries(fields)) { if (v && !student[k]) updates[k] = v; }
          if (Object.keys(updates).length) { await student.update(updates); updated++; } else skipped++;
        } else created++;
      } else {
        await Student.create({ ...fields, sourceFile: analysis.fileName, analysisId: analysis.id });
        created++;
      }
    }
    res.json({ success: true, created, updated, skipped, total: rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/students/extract-bulk
exports.extractBulk = async (req, res) => {
  const { analysisIds } = req.body;
  if (!Array.isArray(analysisIds) || !analysisIds.length)
    return res.status(400).json({ error: 'analysisIds array is required' });
  let totalCreated = 0, totalUpdated = 0, totalSkipped = 0;
  const errors = [];
  for (const analysisId of analysisIds) {
    try {
      const analysis = await Analysis.findByPk(analysisId);
      if (!analysis) { errors.push({ analysisId, error: 'Not found' }); continue; }
      for (const row of (analysis.rawData || [])) {
        const fields = extractFromRow(row);
        if (!fields.name && !fields.rollNumber && !fields.aadhaar) { totalSkipped++; continue; }
        const where = fields.rollNumber ? { rollNumber: fields.rollNumber } : fields.aadhaar ? { aadhaar: fields.aadhaar } : null;
        if (where) {
          const [student, wasCreated] = await Student.findOrCreate({ where, defaults: { ...fields, sourceFile: analysis.fileName, analysisId: analysis.id } });
          if (!wasCreated) {
            const updates = {};
            for (const [k, v] of Object.entries(fields)) { if (v && !student[k]) updates[k] = v; }
            if (Object.keys(updates).length) { await student.update(updates); totalUpdated++; } else totalSkipped++;
          } else totalCreated++;
        } else {
          await Student.create({ ...fields, sourceFile: analysis.fileName, analysisId: analysis.id });
          totalCreated++;
        }
      }
    } catch (e) { errors.push({ analysisId, error: e.message }); }
  }
  res.json({ success: true, created: totalCreated, updated: totalUpdated, skipped: totalSkipped, errors });
};

// GET /api/students
exports.list = async (req, res) => {
  try {
    const { search, searchColumn, page = 1, limit = 50 } = req.query;
    const ALLOWED_COLUMNS = ['name', 'rollNumber', 'aadhaar', 'phone', 'email', 'pan', 'dlNumber'];
    let where = {};
    if (search) {
      if (searchColumn && ALLOWED_COLUMNS.includes(searchColumn)) {
        where = { [searchColumn]: { [Op.iLike]: `%${search}%` } };
      } else {
        where = {
          [Op.or]: [
            { name:       { [Op.iLike]: `%${search}%` } },
            { rollNumber: { [Op.iLike]: `%${search}%` } },
            { aadhaar:    { [Op.iLike]: `%${search}%` } },
            { phone:      { [Op.iLike]: `%${search}%` } },
          ],
        };
      }
    }
    const { count, rows } = await Student.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit) });
    res.json({ students: rows, total: count, page: parseInt(page), pages: Math.ceil(count / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/students
exports.create = async (req, res) => {
  try { const student = await Student.create(req.body); res.json(student); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

// PUT /api/students/:id
exports.update = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    await student.update(req.body);
    res.json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /api/students/:id
exports.remove = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    await student.destroy();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/students/stats
exports.stats = async (req, res) => {
  try {
    const total       = await Student.count();
    const verified    = await Student.count({ where: { verified: true } });
    const withAadhaar = await Student.count({ where: { aadhaar:  { [Op.ne]: null } } });
    const withPan     = await Student.count({ where: { pan:      { [Op.ne]: null } } });
    const withDl      = await Student.count({ where: { dlNumber: { [Op.ne]: null } } });
    res.json({ total, verified, withAadhaar, withPan, withDl });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
