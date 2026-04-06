const { sendEmail } = require('../utils/mailer');
const sendSMS = require('../utils/smsSender');
const Analysis = require('../models/Analysis');
const axios = require('axios');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBJECT = 'Data Verification Required';
const MESSAGE = 'Your details are incomplete or could not be verified. Please click the button below to update your information. Your existing details are already filled in — just complete the missing fields and submit.';

const FORM_BASE = 'https://docs.google.com/forms/d/e/1FAIpQLScmWJJaZOKINhwpdABnBfoo5Lx-fKVwbWBtr_g1DwaE-_b5eg/viewform';

// Maps normalised DB column name → form entry ID
// Form field order: NAME, Email, AADHAR, ROLL NUMBER, PHONE NUMBER
const ENTRY_MAP = {
  'email':       'entry.541960522',
  'rollnumber':  'entry.655531758',
  'name':        'entry.103162702',
  'phonenumber': 'entry.69552159',
  'aadhar':      'entry.1203760852',
};

function norm(str) {
  return String(str).toLowerCase().replace(/[\s_\-]+/g, '').replace(/number$/, '');
}

function buildPrefilledUrl(row) {
  const params = new URLSearchParams();
  params.set('usp', 'pp_url');
  for (const [col, val] of Object.entries(row)) {
    const entryId = ENTRY_MAP[norm(col)];
    if (entryId && val && String(val).trim()) {
      params.set(entryId, String(val).trim());
    }
  }
  return `${FORM_BASE}?${params.toString()}`;
}

/**
 * POST /api/notifications/send-email-alerts
 * Body: { emails, analysisId, rowIndices: { "email": rowIndex } }
 */
exports.sendEmailAlerts = async (req, res) => {
  const { emails, analysisId, rowIndices } = req.body;
  if (!Array.isArray(emails) || emails.length === 0)
    return res.status(400).json({ error: 'emails array is required' });

  const valid   = emails.map(e => String(e).trim()).filter(e => EMAIL_REGEX.test(e));
  const invalid = emails.map(e => String(e).trim()).filter(e => !EMAIL_REGEX.test(e));

  // Respond immediately
  res.json({ success: true, total: emails.length, emailsSent: valid.length, errors: invalid.map(e => ({ email: e, error: 'Invalid email' })) });

  // Load analysis to get row data for pre-filling
  let analysis = null;
  if (analysisId) {
    try { analysis = await Analysis.findByPk(analysisId); } catch (_) {}
  }

  // Send in background with pre-filled form link
  for (const addr of valid) {
    let formLink = process.env.GOOGLE_FORM_URL || FORM_BASE;
    if (analysis && rowIndices && rowIndices[addr] !== undefined) {
      const row = (analysis.rawData || [])[rowIndices[addr]];
      if (row) formLink = buildPrefilledUrl(row);
    }
    sendEmail(addr, SUBJECT, MESSAGE, formLink)
      .then(() => console.log(`[EMAIL] Sent to ${addr}`))
      .catch(err => console.error(`[EMAIL] Failed for ${addr}: ${err.message}`));
  }
};

/**
 * POST /api/notifications/send-manual
 * Body: { phones: [{ phone, message }] }
 */
exports.sendManualSms = async (req, res) => {
  const { phones } = req.body;
  if (!Array.isArray(phones) || phones.length === 0)
    return res.status(400).json({ error: 'phones array is required' });

  res.json({ success: true, total: phones.length });

  for (const { phone, message } of phones) {
    await sendSMS(phone, message);
  }
};
exports.sendNotifications = async (req, res) => res.json({ success: true });
exports.getNotificationLogs = async (req, res) => res.json({ total: 0, logs: [] });

/**
 * POST /api/notifications/send-whatsapp
 * Body: { phones: [{ phone, message }] }
 */
exports.sendWhatsAppAlerts = async (req, res) => {
  const { phones } = req.body;
  if (!Array.isArray(phones) || phones.length === 0)
    return res.status(400).json({ error: 'phones array is required' });

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId)
    return res.status(500).json({ error: 'WhatsApp API not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env' });

  res.json({ success: true, total: phones.length });

  for (const { phone, message } of phones) {
    const cleaned = String(phone).replace(/\D/g, '');
    const to = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
    try {
      await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        { messaging_product: 'whatsapp', to, type: 'text', text: { body: message } },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      console.log(`[WHATSAPP] Sent to ${to}`);
    } catch (e) {
      console.error(`[WHATSAPP] Failed for ${to}: ${e.response?.data?.error?.message || e.message}`);
    }
  }
};
