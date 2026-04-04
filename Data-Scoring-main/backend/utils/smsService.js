const SMS_MESSAGE = 'Your data is not verified. Please update your details.';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * SIMULATED SMS — logs to console instead of sending a real SMS.
 * Replace this function body with a real provider (Twilio, Fast2SMS, etc.) for production.
 */
async function sendSMS(phone, message) {
  await delay(300); // simulate network latency
  console.log(`\n📱 [SMS SIMULATED]`);
  console.log(`   To      : ${phone}`);
  console.log(`   Message : ${message}`);
  console.log(`   Status  : Delivered (simulated)\n`);
  return { requestId: `SIM-${Date.now()}-${phone}` };
}

module.exports = { sendSMS, SMS_MESSAGE };
