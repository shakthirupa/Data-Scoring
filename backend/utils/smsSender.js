const axios = require('axios');

const SMS_API_URL = process.env.SMS_API_URL || 'http://10.50.24.15:8080/send-sms';

async function sendSMS(phone, message) {
  try {
    const res = await axios.post(SMS_API_URL, { phone, message });
    console.log('SMS sent:', res.data);
    return { success: true, data: res.data };
  } catch (err) {
    console.error('SMS error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = sendSMS;
