const express = require('express');
const router = express.Router();
const { sendNotifications, getNotificationLogs, sendManualSms, sendEmailAlerts, sendWhatsAppAlerts } = require('../controllers/notificationController');
const auth = require('../middleware/auth');

router.post('/send',               auth, sendNotifications);
router.post('/send-manual',        auth, sendManualSms);
router.post('/send-email-alerts',  auth, sendEmailAlerts);
router.post('/send-whatsapp',      auth, sendWhatsAppAlerts);
router.get('/:analysisId',         auth, getNotificationLogs);

module.exports = router;
