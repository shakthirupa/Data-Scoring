const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const comparisonController = require('../controllers/comparisonController');

router.use(auth);

router.get('/relationships', comparisonController.getSavedRelationships);
router.post('/relationships/scan', comparisonController.findRelationships);
router.delete('/relationships/:id', comparisonController.deleteRelationship);
router.post('/compare', comparisonController.compareAnalyses);
router.get('/search', comparisonController.searchAnalyses);

module.exports = router;
