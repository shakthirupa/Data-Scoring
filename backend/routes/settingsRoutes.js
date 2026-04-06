const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const settingsController = require('../controllers/settingsController');

router.use(auth);

router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);
router.post('/regenerate-key', settingsController.regenerateApiKey);

module.exports = router;
