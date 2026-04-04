const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOtpEmail(to, otp, type) {
  const subject = type === 'signup' ? 'Verify your DataQuality AI account' : 'Your DataQuality AI login OTP';
  const action  = type === 'signup' ? 'complete your registration' : 'sign in to your account';

  await transporter.sendMail({
    from: `"DataQuality AI" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border-radius:12px;border:1px solid #e5e7eb;">
        <h2 style="color:#059669;margin-bottom:8px;">DataQuality AI</h2>
        <p style="color:#374151;">Use the OTP below to ${action}. It expires in <strong>5 minutes</strong>.</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#111827;text-align:center;padding:24px 0;">${otp}</div>
        <p style="color:#6b7280;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { generateOtp, sendOtpEmail };
