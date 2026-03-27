const express = require('express');
const router = express.Router();
const comparisonController = require('../controllers/comparisonController');

router.post('/compare', comparisonController.compareAnalyses);
router.get('/search', comparisonController.searchAnalyses);

module.exports = router;
