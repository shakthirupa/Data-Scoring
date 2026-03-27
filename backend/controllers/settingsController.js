const Settings = require('../models/Settings');

exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ apiKey: 'sk_' + Math.random().toString(36).substr(2, 9) });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { notifications, thresholds } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ notifications, thresholds });
    } else {
      await settings.update({ notifications, thresholds });
    }
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.regenerateApiKey = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    await settings.update({ apiKey: 'sk_' + Math.random().toString(36).substr(2, 9) });
    res.json({ success: true, apiKey: settings.apiKey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
