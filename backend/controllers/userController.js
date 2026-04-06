const User = require('../models/User');
const OtpVerification = require('../models/OtpVerification');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateOtp, sendOtpEmail } = require('../utils/mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'dataquality_secret_key';

exports.signup = async (req, res) => {
  try {
    const { name, email, password, organisation } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await OtpVerification.destroy({ where: { email } });
    // Hash password and send OTP in parallel
    const [hashed] = await Promise.all([
      bcrypt.hash(password, 10),
      sendOtpEmail(email, otp, 'signup'),
    ]);
    await OtpVerification.create({ email, otp, name, password: hashed, organisation: organisation || '', expiresAt });
    res.json({ otpSent: true, email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });
    const record = await OtpVerification.findOne({ where: { email } });
    if (!record) return res.status(400).json({ error: 'OTP not found. Please sign up again.' });
    if (new Date() > new Date(record.expiresAt)) {
      await record.destroy();
      return res.status(400).json({ error: 'OTP has expired. Please sign up again.' });
    }
    if (record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    const user = await User.create({ name: record.name, email: record.email, password: record.password, organization: record.organisation });
    await record.destroy();
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, name: user.name, email: user.email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, name: user.name, email: user.email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, { attributes: { exclude: ['password'] } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Compute live stats from Analysis table
    const Analysis = require('../models/Analysis');
    const analyses = await Analysis.findAll({ attributes: ['overallScore', 'createdAt'] });
    const totalAnalyses = analyses.length;
    const avgQualityScore = totalAnalyses > 0
      ? Math.round(analyses.reduce((s, a) => s + (a.overallScore || 0), 0) / totalAnalyses)
      : 0;
    const firstUpload = analyses.length > 0
      ? new Date(Math.min(...analyses.map(a => new Date(a.createdAt))))
      : new Date();
    const daysActive = Math.max(1, Math.floor((Date.now() - firstUpload) / (1000 * 60 * 60 * 24)));

    res.json({ ...user.toJSON(), totalAnalyses, avgQualityScore, daysActive });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
