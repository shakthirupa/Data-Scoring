const Settings = require('../models/Settings');

exports.getSettings = async (req, res) => {
  try {
    const userId = req.userId;
    let settings = await Settings.findOne({ where: { userId } });
    if (!settings) {
      settings = await Settings.create({ userId, apiKey: 'sk_' + Math.random().toString(36).substr(2, 9) });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const userId = req.userId;
    const { notifications, thresholds, nullableColumns } = req.body;
    let settings = await Settings.findOne({ where: { userId } });
    if (!settings) {
      settings = await Settings.create({ userId, notifications, thresholds, nullableColumns });
    } else {
      await settings.update({ notifications, thresholds, nullableColumns });
    }
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.regenerateApiKey = async (req, res) => {
  try {
    const userId = req.userId;
    let settings = await Settings.findOne({ where: { userId } });
    if (!settings) settings = await Settings.create({ userId });
    await settings.update({ apiKey: 'sk_' + Math.random().toString(36).substr(2, 9) });
    res.json({ success: true, apiKey: settings.apiKey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Used internally by analysisController
exports.getNullableColumns = async (userId) => {
  const settings = await Settings.findOne({ where: { userId } });
  return settings?.nullableColumns || [];
};
