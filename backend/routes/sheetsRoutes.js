const express = require('express');
const router  = express.Router();
const { syncFromSheet } = require('../controllers/sheetsController');
const auth = require('../middleware/auth');

router.post('/sync/:analysisId', auth, syncFromSheet);

module.exports = router;
