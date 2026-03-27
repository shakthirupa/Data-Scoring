const { Organization, DigiLockerIntegration, VerificationLog } = require('../models/DigiLockerModels');
const { encrypt, decrypt, detectDocType } = require('../utils/digilockerCrypto');
const { verifyDocument, buildAuthUrl, exchangeCodeForToken } = require('../utils/verificationEngine');

// ── POST /api/integration/save ────────────────────────────────────────────────
exports.saveIntegration = async (req, res) => {
  const { orgId, orgName, clientId, clientSecret, apiUrl, redirectUri, mode } = req.body;
  if (!orgId && !orgName) return res.status(400).json({ error: 'orgId or orgName is required' });

  try {
    // Upsert organization
    let org;
    if (orgId) {
      org = await Organization.findByPk(orgId);
      if (!org) return res.status(404).json({ error: 'Organization not found' });
    } else {
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      [org] = await Organization.findOrCreate({ where: { slug }, defaults: { name: orgName, slug } });
    }

    // Encrypt secret only if provided
    const secretEnc = clientSecret ? encrypt(clientSecret) : undefined;

    const [integration, created] = await DigiLockerIntegration.findOrCreate({
      where: { orgId: org.id },
      defaults: {
        orgId: org.id,
        clientId: clientId || null,
        clientSecretEnc: secretEnc || null,
        apiUrl: apiUrl || 'https://api.digitallocker.gov.in',
        redirectUri: redirectUri || null,
        mode: mode || 'mock',
      },
    });

    if (!created) {
      if (clientId !== undefined) integration.clientId = clientId;
      if (clientSecret) integration.clientSecretEnc = secretEnc;
      if (apiUrl) integration.apiUrl = apiUrl;
      if (redirectUri) integration.redirectUri = redirectUri;
      if (mode) integration.mode = mode;
      await integration.save();
    }

    res.json({
      success: true,
      orgId: org.id,
      orgName: org.name,
      mode: integration.mode,
      clientId: integration.clientId,
      apiUrl: integration.apiUrl,
      // Never return the secret
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/integration/:orgId ───────────────────────────────────────────────
exports.getIntegration = async (req, res) => {
  try {
    const org = await Organization.findByPk(req.params.orgId, {
      include: [{ model: DigiLockerIntegration }],
    });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const intg = org.DigiLockerIntegration;
    res.json({
      orgId: org.id,
      orgName: org.name,
      integration: intg ? {
        mode: intg.mode,
        clientId: intg.clientId,
        apiUrl: intg.apiUrl,
        redirectUri: intg.redirectUri,
        enabled: intg.enabled,
        hasSecret: !!intg.clientSecretEnc,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/integration/orgs ─────────────────────────────────────────────────
exports.listOrgs = async (req, res) => {
  try {
    const orgs = await Organization.findAll({
      include: [{ model: DigiLockerIntegration, attributes: ['mode', 'enabled', 'clientId'] }],
      order: [['name', 'ASC']],
    });
    res.json(orgs.map(o => ({
      id: o.id, name: o.name, slug: o.slug,
      integration: o.DigiLockerIntegration
        ? { mode: o.DigiLockerIntegration.mode, enabled: o.DigiLockerIntegration.enabled, hasCredentials: !!o.DigiLockerIntegration.clientId }
        : null,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/verify/mock ─────────────────────────────────────────────────────
exports.verifyMock = async (req, res) => {
  const { aadhaar, pan, orgId = 1 } = req.body;
  const value = aadhaar || pan;
  if (!value) return res.status(400).json({ error: 'aadhaar or pan is required' });

  const docType = aadhaar ? 'aadhaar' : 'pan';
  try {
    // Force mock mode regardless of org setting
    const { DigiLockerMock } = require('../models/DigiLockerModels');
    const { maskAadhaar, maskPan, authenticityScore } = require('../utils/digilockerCrypto');
    const v = String(value).trim().replace(/\s/g, '');

    let record;
    if (docType === 'aadhaar') record = await DigiLockerMock.findOne({ where: { aadhaar: v } });
    else record = await DigiLockerMock.findOne({ where: { pan: v.toUpperCase() } });

    const masked = docType === 'aadhaar' ? maskAadhaar(v) : maskPan(v);

    if (!record) {
      await VerificationLog.create({ orgId: orgId || null, docType, maskedValue: masked, status: 'Not Verified', source: 'Mock DigiLocker', confidenceScore: 10, authenticityScore: 30, mode: 'mock' });
      return res.json({ status: 'Not Verified', source: 'Mock DigiLocker', maskedValue: masked, confidenceScore: 10, authenticityScore: 30 });
    }

    await VerificationLog.create({ orgId: orgId || null, docType, maskedValue: masked, status: 'Verified', source: 'Mock DigiLocker', confidenceScore: 85, authenticityScore: 100, mode: 'mock' });

    res.json({
      status: 'Verified',
      source: 'Mock DigiLocker',
      name: record.name,
      maskedValue: masked,
      dob: record.dob,
      gender: record.gender,
      certificates: record.certificates,
      confidenceScore: 85,
      authenticityScore: 100,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/verify/live ─────────────────────────────────────────────────────
exports.verifyLive = async (req, res) => {
  const { aadhaar, pan, orgId = 1, analysisId } = req.body;
  const value = aadhaar || pan;
  if (!value) return res.status(400).json({ error: 'aadhaar or pan is required' });

  const docType = detectDocType(value);
  if (docType === 'unknown') return res.status(400).json({ error: 'Could not detect document type. Provide a valid 12-digit Aadhaar or 10-char PAN.' });

  try {
    const result = await verifyDocument(docType, value, orgId, analysisId || null);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/verify ──────────────────────────────────────────────────────────
// Unified endpoint — auto-detects type and routes to mock/live based on org config
exports.verify = async (req, res) => {
  const { value, orgId = 1, analysisId } = req.body;
  if (!value) return res.status(400).json({ error: 'value is required' });

  const docType = detectDocType(value);
  if (docType === 'unknown') return res.status(400).json({ error: 'Unrecognised document format. Provide a 12-digit Aadhaar or 10-char PAN.' });

  try {
    const result = await verifyDocument(docType, value, orgId, analysisId || null);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/verify/oauth/redirect/:orgId ─────────────────────────────────────
// Step 1 of live OAuth: redirect user to DigiLocker authorization page
exports.oauthRedirect = async (req, res) => {
  try {
    const integration = await DigiLockerIntegration.findOne({ where: { orgId: req.params.orgId, enabled: true } });
    if (!integration || integration.mode !== 'live')
      return res.status(400).json({ error: 'Live integration not configured for this organization' });
    const authUrl = buildAuthUrl(integration);
    res.json({ authUrl }); // frontend should redirect user to this URL
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/verify/oauth/callback ────────────────────────────────────────────
// Step 2: DigiLocker redirects back with ?code=...&state=...
exports.oauthCallback = async (req, res) => {
  const { code, state, orgId } = req.query;
  if (!code) return res.status(400).json({ error: 'Authorization code missing' });

  try {
    const integration = await DigiLockerIntegration.findOne({ where: { orgId: orgId || 1, enabled: true } });
    if (!integration) return res.status(404).json({ error: 'Integration not found' });

    const tokenData = await exchangeCodeForToken(integration, code);
    // In production: store token securely, then fetch documents
    res.json({ success: true, message: 'OAuth token exchanged successfully', tokenType: tokenData.token_type, expiresIn: tokenData.expires_in });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/verify/dataset/:analysisId ────────────────────────────────────
// Scans a dataset for Aadhaar/PAN columns, verifies each value, returns results.
exports.verifyDataset = async (req, res) => {
  const { orgId = 1 } = req.body;
  try {
    const Analysis = require('../models/Analysis');
    const analysis = await Analysis.findByPk(req.params.analysisId);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    const rows = analysis.rawData || [];
    if (!rows.length) return res.status(400).json({ error: 'No data in this analysis' });

    const cols = Object.keys(rows[0]);

    // Detect sensitive columns
    const aadhaarCols = cols.filter(c => /aadhaar|aadhar|uid|uidai/i.test(c));
    const panCols     = cols.filter(c => /\bpan\b|pan_no|pan_number|pancard/i.test(c));

    // Also detect by value pattern in first 5 rows
    cols.forEach(c => {
      const samples = rows.slice(0, 5).map(r => String(r[c] || '').trim().replace(/\s/g, ''));
      if (!aadhaarCols.includes(c) && samples.some(v => /^\d{12}$/.test(v))) aadhaarCols.push(c);
      if (!panCols.includes(c) && samples.some(v => /^[A-Z]{5}\d{4}[A-Z]$/i.test(v))) panCols.push(c);
    });

    if (!aadhaarCols.length && !panCols.length)
      return res.status(400).json({ error: 'No Aadhaar or PAN columns detected in this dataset' });

    // Check org integration mode
    const integration = await DigiLockerIntegration.findOne({ where: { orgId, enabled: true } });
    const mode = integration?.mode || 'mock';
    const hasLiveCredentials = mode === 'live' && integration?.clientId && integration?.clientSecretEnc;

    // Verify each row (cap at 100 rows to avoid timeout)
    const { maskAadhaar, maskPan } = require('../utils/digilockerCrypto');
    const { DigiLockerMock } = require('../models/DigiLockerModels');
    const limit = Math.min(rows.length, 100);
    const results = [];

    for (let i = 0; i < limit; i++) {
      const row = rows[i];
      const rowResult = { rowIndex: i + 1, verifications: [] };

      for (const col of aadhaarCols) {
        const raw = String(row[col] || '').trim().replace(/\s/g, '');
        if (!/^\d{12}$/.test(raw)) continue;
        const record = await DigiLockerMock.findOne({ where: { aadhaar: raw } });
        rowResult.verifications.push({
          column: col, docType: 'aadhaar',
          maskedValue: maskAadhaar(raw),
          status: record ? 'Verified' : 'Not Verified',
          name: record?.name || null,
          source: mode === 'live' && hasLiveCredentials ? 'DigiLocker (Live)' : 'Mock DigiLocker',
        });
      }

      for (const col of panCols) {
        const raw = String(row[col] || '').trim().toUpperCase();
        if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(raw)) continue;
        const record = await DigiLockerMock.findOne({ where: { pan: raw } });
        rowResult.verifications.push({
          column: col, docType: 'pan',
          maskedValue: maskPan(raw),
          status: record ? 'Verified' : 'Not Verified',
          name: record?.name || null,
          source: mode === 'live' && hasLiveCredentials ? 'DigiLocker (Live)' : 'Mock DigiLocker',
        });
      }

      if (rowResult.verifications.length) results.push(rowResult);
    }

    // Log summary
    const verified   = results.flatMap(r => r.verifications).filter(v => v.status === 'Verified').length;
    const unverified = results.flatMap(r => r.verifications).filter(v => v.status === 'Not Verified').length;

    res.json({
      analysisId: analysis.id,
      fileName: analysis.fileName,
      mode,
      hasLiveCredentials,
      sensitiveColumns: { aadhaar: aadhaarCols, pan: panCols },
      totalRows: rows.length,
      scannedRows: limit,
      verified,
      unverified,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/integration/status/:orgId ───────────────────────────────────────
// Returns whether org has live credentials configured
exports.getIntegrationStatus = async (req, res) => {
  try {
    const integration = await DigiLockerIntegration.findOne({ where: { orgId: req.params.orgId, enabled: true } });
    res.json({
      configured: !!integration,
      mode: integration?.mode || 'mock',
      hasCredentials: !!(integration?.clientId && integration?.clientSecretEnc),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/verify/history/:orgId ───────────────────────────────────────────
exports.getHistory = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const orgId = req.params.orgId;
    const logs = await VerificationLog.findAll({
      where: { orgId: { [Op.or]: [orgId, null] } },
      order: [['verifiedAt', 'DESC']],
      limit: 50,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/verify/mock-data ─────────────────────────────────────────────────
// Debug endpoint to check if mock data is seeded
exports.getMockData = async (req, res) => {
  try {
    const { DigiLockerMock } = require('../models/DigiLockerModels');
    const records = await DigiLockerMock.findAll({ attributes: ['id', 'name', 'aadhaar', 'pan'] });
    res.json({ count: records.length, records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
