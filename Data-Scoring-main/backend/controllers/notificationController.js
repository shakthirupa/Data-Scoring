const Analysis = require('../models/Analysis');
const NotificationLog = require('../models/NotificationLog');
const { validateRecord } = require('../utils/recordValidator');
const { sendSMS, SMS_MESSAGE } = require('../utils/smsService');
const { sendEmail } = require('../utils/mailer');
const { Op } = require('sequelize');

const SMS_DELAY_MS = 1000; // 1 second between SMS to avoid rate limits

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * POST /api/notifications/send
 * Body: { analysisId }
 */
exports.sendNotifications = async (req, res) => {
  const { analysisId } = req.body;
  if (!analysisId) return res.status(400).json({ error: 'analysisId is required' });

  const analysis = await Analysis.findByPk(analysisId);
  if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

  const rawData = analysis.rawData;
  if (!Array.isArray(rawData) || rawData.length === 0)
    return res.status(400).json({ error: 'No records found in this analysis' });

  // Find which record indices already have logs (to skip re-processing)
  const existingLogs = await NotificationLog.findAll({
    where: { analysisId },
    attributes: ['recordIndex'],
  });
  const alreadyProcessed = new Set(existingLogs.map(l => l.recordIndex));

  const summary = {
    total: rawData.length,
    alreadyProcessed: alreadyProcessed.size,
    invalid: 0,
    smsSent: 0,
    smsSkipped: 0,   // invalid but no valid phone
    smsErrors: 0,
    newlyProcessed: 0,
  };

  for (let i = 0; i < rawData.length; i++) {
    if (alreadyProcessed.has(i)) continue; // skip already-processed rows

    const record = rawData[i];
    const { isVerified, reasons, cleanedPhone, name, email, phone } = validateRecord(record);

    summary.newlyProcessed++;

    const logEntry = {
      analysisId,
      recordIndex: i,
      name,
      email,
      phone,
      isVerified,
      failReasons: JSON.stringify(reasons),
      smsSent: false,
      smsError: null,
    };

    if (!isVerified) {
      summary.invalid++;

      if (cleanedPhone) {
        // Valid phone exists — send SMS
        try {
          await sendSMS(cleanedPhone, SMS_MESSAGE);
          logEntry.smsSent = true;
          summary.smsSent++;
          await delay(SMS_DELAY_MS);
        } catch (err) {
          logEntry.smsError = err.message;
          summary.smsErrors++;
          console.error(`[SMS] Failed for row ${i} (${phone}): ${err.message}`);
        }
      } else {
        // No valid phone — log and skip
        summary.smsSkipped++;
        console.log(`[SMS] Skipped row ${i} — no valid phone. Reasons: ${reasons.join(', ')}`);
      }
    }

    await NotificationLog.create(logEntry);
  }

  res.json({
    success: true,
    analysisId,
    summary,
  });
};

/**
 * GET /api/notifications/:analysisId
 * Returns all notification logs for an analysis
 */
exports.getNotificationLogs = async (req, res) => {
  const { analysisId } = req.params;
  const logs = await NotificationLog.findAll({
    where: { analysisId },
    order: [['recordIndex', 'ASC']],
  });
  const smsSent   = logs.filter(l => l.smsSent).length;
  const invalid   = logs.filter(l => !l.isVerified).length;
  const verified  = logs.filter(l => l.isVerified).length;
  res.json({
    total: logs.length,
    verified,
    invalid,
    smsSent,
    logs: logs.map(l => ({
      recordIndex: l.recordIndex,
      name: l.name,
      email: l.email,
      phone: l.phone,
      isVerified: l.isVerified,
      smsSent: l.smsSent,
      smsError: l.smsError,
      failReasons: l.failReasons ? JSON.parse(l.failReasons) : [],
    })),
  });
};

/**
 * POST /api/notifications/send-manual
 * Body: { phones: ["9876543210", ...] }
 * Sends SMS to a manually-supplied list of phone numbers.
 */
exports.sendManualSms = async (req, res) => {
  const { phones } = req.body;
  if (!Array.isArray(phones) || phones.length === 0)
    return res.status(400).json({ error: 'phones array is required' });

  const MANUAL_MESSAGE = 'Your data is not verified. Please update your details.';
  let smsSent = 0;
  const errors = [];

  for (const phone of phones) {
    const cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length !== 10) {
      errors.push({ phone, error: 'Invalid phone number (must be 10 digits)' });
      continue;
    }
    try {
      await sendSMS(cleaned, MANUAL_MESSAGE);
      smsSent++;
    } catch (err) {
      errors.push({ phone, error: err.message });
    }
  }

  res.json({ success: true, total: phones.length, smsSent, errors });
};

/**
 * POST /api/notifications/send-email-alerts
 * Body: { emails: ["user1@gmail.com", ...] }
 * Sends "data not verified" email to each address.
 */
exports.sendEmailAlerts = async (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails) || emails.length === 0)
    return res.status(400).json({ error: 'emails array is required' });

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const SUBJECT = 'Data Verification Required';
  const MESSAGE = 'Your details are not verified. Please update your information.';

  let emailsSent = 0;
  const errors = [];

  for (const email of emails) {
    const addr = String(email).trim();
    if (!EMAIL_REGEX.test(addr)) {
      errors.push({ email: addr, error: 'Invalid email address' });
      continue;
    }
    try {
      await sendEmail(addr, SUBJECT, MESSAGE);
      emailsSent++;
      console.log(`[EMAIL] Sent to ${addr}`);
      await delay(1000);
    } catch (err) {
      errors.push({ email: addr, error: err.message });
      console.error(`[EMAIL] Failed for ${addr}: ${err.message}`);
    }
  }

  res.json({ success: true, total: emails.length, emailsSent, errors });
};
