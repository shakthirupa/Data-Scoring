const User = require('../models/User');
const OtpVerification = require('../models/OtpVerification');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateOtp, sendOtpEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'dataquality_secret_key';
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 3;

async function upsertOtp(email, type) {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  await OtpVerification.destroy({ where: { email, type } });
  await OtpVerification.create({ email, otp, type, attempts: 0, expiresAt });
  return otp;
}

async function verifyOtp(email, otp, type) {
  const record = await OtpVerification.findOne({ where: { email, type } });
  if (!record) return { error: 'OTP not found. Please request a new one.' };
  if (new Date() > record.expiresAt) {
    await record.destroy();
    return { error: 'OTP has expired. Please request a new one.' };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    await record.destroy();
    return { error: 'Too many incorrect attempts. Please request a new OTP.' };
  }
  if (record.otp !== otp) {
    await record.increment('attempts');
    const left = MAX_ATTEMPTS - record.attempts - 1;
    return { error: `Incorrect OTP. ${left} attempt(s) remaining.` };
  }
  await record.destroy();
  return { success: true };
}

// POST /api/user/signup — send OTP, don't create user yet
exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const existing = await User.findOne({ where: { email } });
    if (existing && existing.isVerified) return res.status(400).json({ error: 'Email already registered' });
    // Remove any unverified account with same email so we can re-register
    if (existing && !existing.isVerified) await existing.destroy();
    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashed, isVerified: false });
    const otp = await upsertOtp(email, 'signup');
    await sendOtpEmail(email, otp, 'signup');
    res.json({ message: 'OTP sent to your email. Please verify to complete signup.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/user/verify-signup-otp
exports.verifySignupOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await verifyOtp(email, otp, 'signup');
    if (result.error) return res.status(400).json({ error: result.error });
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await user.update({ isVerified: true });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/user/login — validate credentials, send OTP
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.isVerified) return res.status(403).json({ error: 'Email not verified. Please complete signup verification.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });
    const otp = await upsertOtp(email, 'login');
    await sendOtpEmail(email, otp, 'login');
    res.json({ message: 'OTP sent to your email.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/user/verify-login-otp
exports.verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await verifyOtp(email, otp, 'login');
    if (result.error) return res.status(400).json({ error: result.error });
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/user/resend-otp
exports.resendOtp = async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!['signup', 'login'].includes(type)) return res.status(400).json({ error: 'Invalid OTP type' });
    const otp = await upsertOtp(email, type);
    await sendOtpEmail(email, otp, type);
    res.json({ message: 'OTP resent successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, { attributes: { exclude: ['password'] } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const Analysis = require('../models/Analysis');
    const analyses = await Analysis.findAll({ attributes: ['overallScore', 'createdAt'] });
    const totalAnalyses = analyses.length;
    const avgQualityScore = totalAnalyses > 0
      ? Math.round(analyses.reduce((s, a) => s + (a.overallScore || 0), 0) / totalAnalyses) : 0;
    const firstUpload = analyses.length > 0
      ? new Date(Math.min(...analyses.map(a => new Date(a.createdAt)))) : new Date();
    const daysActive = Math.max(1, Math.floor((Date.now() - firstUpload) / (1000 * 60 * 60 * 24)));
    res.json({ ...user.toJSON(), totalAnalyses, avgQualityScore, daysActive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both fields are required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const user = await User.findByPk(req.userId);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    await user.update({ password: await bcrypt.hash(newPassword, 10) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email, organization, role } = req.body;
    const user = await User.findByPk(req.userId);
    await user.update({ name, email, organization, role });
    const updated = user.toJSON();
    delete updated.password;
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
