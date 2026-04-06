const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');
const DriveConnection = require('../models/DriveConnection');

function getServiceAccountAuth() {
  const keyFile = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').trim();
  const email   = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').replace(/"/g, '').trim();
  const rawKey  = (process.env.GOOGLE_PRIVATE_KEY || '').trim();
  if (keyFile && fs.existsSync(keyFile)) {
    return new google.auth.GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  }
  if (email && rawKey) {
    return new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: rawKey.replace(/\\n/g, '\n') },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  }
  return null;
}

const SUPPORTED_MIME = new Set([
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.google-apps.spreadsheet',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff',
]);

const EXT_MAP = {
  'text/csv': '.csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'image/bmp': '.bmp', 'image/tiff': '.tiff',
};

// In-memory progress store keyed by jobId
const jobProgress = {};
exports.getJobProgress = (req, res) => {
  const job = jobProgress[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
};

// ── POST /api/drive/connect ──────────────────────────────────────────────────
exports.saveConnection = async (req, res) => {
  const { folderId, folderName } = req.body;
  if (!folderId || !folderName) return res.status(400).json({ error: 'folderId and folderName required' });
  const userId = req.user.id;
  const [conn] = await DriveConnection.findOrCreate({ where: { userId, folderId }, defaults: { userId, folderName, connectedAt: new Date() } });
  await conn.update({ folderName, connectedAt: new Date() });
  res.json({ success: true, connection: conn });
};

// ── GET /api/drive/connections ────────────────────────────────────────────────
exports.getConnections = async (req, res) => {
  const connections = await DriveConnection.findAll({ where: { userId: req.user.id }, order: [['connectedAt', 'DESC']], limit: 20 });
  res.json({ connections });
};

// ── GET /api/drive/service-email ──────────────────────────────────────────────
exports.getServiceEmail = (req, res) => {
  const email   = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').replace(/"/g, '').trim() || null;
  const keyFile = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY  || '').trim();
  const rawKey  = (process.env.GOOGLE_PRIVATE_KEY || '').trim();
  const configured = !!(
    (keyFile && fs.existsSync(keyFile)) ||
    (email && rawKey && rawKey.includes('BEGIN'))
  );
  res.json({ email, configured });
};

// ── POST /api/drive/browse ────────────────────────────────────────────────────
exports.browse = async (req, res) => {
  const { folderId = 'root' } = req.body;
  const auth = getServiceAccountAuth();
  if (!auth) return res.status(503).json({ error: 'Service account not configured', notConfigured: true });
  try {
    const drive = google.drive({ version: 'v3', auth });
    const resp  = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,size,modifiedTime)',
      orderBy: 'folder,name',
      pageSize: 200,
    });
    const items = (resp.data.files || []).map(f => ({
      id: f.id, name: f.name, mimeType: f.mimeType,
      size: f.size, modifiedTime: f.modifiedTime,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      isSupported: SUPPORTED_MIME.has(f.mimeType),
    }));
    res.json({ items, folderId });
  } catch (err) {
    if (err.code === 403 || err.message?.includes('notFound')) {
      return res.status(403).json({ error: `Access denied. Share the folder with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} (Viewer) first.` });
    }
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/drive/import-folder ─────────────────────────────────────────────
// Recursively imports all supported files — processes 5 at a time in parallel
exports.importFolder = async (req, res) => {
  const { folderId } = req.body;
  if (!folderId) return res.status(400).json({ error: 'folderId is required' });

  const auth = getServiceAccountAuth();
  if (!auth) return res.status(503).json({ error: 'Service account not configured', notConfigured: true });

  // Return a jobId immediately so the frontend can poll progress
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  jobProgress[jobId] = { status: 'scanning', done: 0, total: 0, imported: [], errors: [] };
  res.json({ jobId });

  // Run the actual work in the background
  ;(async () => {
    try {
      const drive = google.drive({ version: 'v3', auth });
      const allFiles = [];
      async function collect(id, folderName) {
        const resp = await drive.files.list({
          q: `'${id}' in parents and trashed=false`,
          fields: 'files(id,name,mimeType)',
          pageSize: 200,
        });
        for (const f of resp.data.files || []) {
          if (f.mimeType === 'application/vnd.google-apps.folder') await collect(f.id, f.name);
          else if (SUPPORTED_MIME.has(f.mimeType)) allFiles.push({ ...f, folderName });
        }
      }
      await collect(folderId, 'root');

      jobProgress[jobId].total = allFiles.length;
      jobProgress[jobId].status = 'processing';

      if (!allFiles.length) { jobProgress[jobId].status = 'done'; return; }

      const fastFiles  = allFiles.filter(f => !f.mimeType.startsWith('image/'));
      const imageFiles = allFiles.filter(f => f.mimeType.startsWith('image/'));
      const { uploadFile } = require('./analysisController');
      const sc = require('./studentController');

      async function processOne(file) {
        try {
          let tmpPath, originalName;
          const uid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
          if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
            const dl = await drive.files.export({ fileId: file.id, mimeType: 'text/csv' }, { responseType: 'arraybuffer' });
            tmpPath = path.join('uploads', `gdrive_${uid}.csv`);
            originalName = file.name.endsWith('.csv') ? file.name : `${file.name}.csv`;
            fs.writeFileSync(tmpPath, Buffer.from(dl.data));
          } else {
            const ext = EXT_MAP[file.mimeType] || path.extname(file.name) || '.bin';
            tmpPath = path.join('uploads', `gdrive_${uid}${ext}`);
            originalName = file.name.includes('.') ? file.name : `${file.name}${ext}`;
            const dl = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'arraybuffer' });
            fs.writeFileSync(tmpPath, Buffer.from(dl.data));
          }
          const analysisResult = await new Promise((resolve, reject) => {
            const fakeReq = { file: { path: tmpPath, originalname: originalName, size: fs.statSync(tmpPath).size }, body: {} };
            const fakeRes = {
              json: resolve,
              status: (code) => ({ json: (d) => reject(new Error(d.error || `HTTP ${code}`)) }),
            };
            uploadFile(fakeReq, fakeRes);
          });
          if (analysisResult.analysisId) {
            await new Promise(resolve => {
              sc.extractFromAnalysis(
                { params: { analysisId: analysisResult.analysisId }, body: {} },
                { json: resolve, status: () => ({ json: resolve }) }
              );
            });
          }
          jobProgress[jobId].imported.push({ file: file.name, analysisId: analysisResult.analysisId });
        } catch (e) {
          jobProgress[jobId].errors.push({ file: file.name, error: e.message });
        }
        jobProgress[jobId].done++;
      }

      for (let i = 0; i < fastFiles.length; i += 10)
        await Promise.all(fastFiles.slice(i, i + 10).map(processOne));
      for (let i = 0; i < imageFiles.length; i += 3)
        await Promise.all(imageFiles.slice(i, i + 3).map(processOne));

      jobProgress[jobId].status = 'done';
      // Clean up after 10 minutes
      setTimeout(() => delete jobProgress[jobId], 10 * 60 * 1000);
    } catch (e) {
      jobProgress[jobId].status = 'error';
      jobProgress[jobId].error = e.message;
    }
  })();
};

// ── POST /api/drive/import ────────────────────────────────────────────────────
exports.importFile = async (req, res) => {
  const { driveUrl, fileId: directId } = req.body;
  let fileId = directId;
  if (!fileId && driveUrl) {
    const m = driveUrl.match(/\/d\/([a-zA-Z0-9_-]{25,})/) || driveUrl.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
    if (!m) return res.status(400).json({ error: 'Could not extract a file ID from this link.' });
    fileId = m[1];
  }
  if (!fileId) return res.status(400).json({ error: 'fileId or driveUrl is required' });

  const auth = getServiceAccountAuth();
  if (!auth) return res.status(503).json({ error: 'Service account not configured', notConfigured: true });

  try {
    const drive = google.drive({ version: 'v3', auth });
    const meta  = await drive.files.get({ fileId, fields: 'name,mimeType' });
    const { name, mimeType } = meta.data;

    let tmpPath, originalName;
    const uid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const resp = await drive.files.export({ fileId, mimeType: 'text/csv' }, { responseType: 'arraybuffer' });
      tmpPath = path.join('uploads', `gdrive_${uid}.csv`);
      originalName = name.endsWith('.csv') ? name : `${name}.csv`;
      fs.writeFileSync(tmpPath, Buffer.from(resp.data));
    } else {
      const ext = EXT_MAP[mimeType] || (name.includes('.') ? path.extname(name) : '.bin');
      tmpPath = path.join('uploads', `gdrive_${uid}${ext}`);
      originalName = name.includes('.') ? name : `${name}${ext}`;
      const resp = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
      fs.writeFileSync(tmpPath, Buffer.from(resp.data));
    }

    const { uploadFile } = require('./analysisController');
    req.file = { path: tmpPath, originalname: originalName, size: fs.statSync(tmpPath).size };
    req.body.fileName = originalName;
    return uploadFile(req, res);
  } catch (err) {
    if (err.code === 403 || err.message?.includes('notFound')) {
      return res.status(403).json({ error: `Access denied. Share the file with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} (Viewer).` });
    }
    res.status(500).json({ error: err.message });
  }
};
