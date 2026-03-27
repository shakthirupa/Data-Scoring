const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');

router.post('/:analysisId/generate', recommendationController.generateRecommendations);
router.get('/:analysisId', recommendationController.getRecommendations);

module.exports = router;
