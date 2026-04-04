const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);
router.post('/regenerate-key', settingsController.regenerateApiKey);

module.exports = router;
