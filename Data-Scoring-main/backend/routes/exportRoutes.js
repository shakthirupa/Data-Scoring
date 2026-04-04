const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

router.get('/report/:analysisId', exportController.exportAnalysisReport);
router.get('/history', exportController.exportAllHistory);

module.exports = router;
