const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const analysisController = require('../controllers/analysisController');

const upload = multer({ dest: 'uploads/' });

router.use(auth);

router.post('/upload', upload.single('file'), analysisController.uploadFile);
router.post('/sheets', upload.single('file'), analysisController.getSheets);
router.post('/upload-url', analysisController.uploadFromUrl);
router.get('/history', analysisController.getHistory);
router.delete('/all', analysisController.deleteAllAnalyses);
router.patch('/:id/verification', analysisController.saveVerificationStatus);
router.delete('/:id', analysisController.deleteAnalysis);
router.get('/:id', analysisController.getAnalysisById);
router.post('/find-relationships', analysisController.findRelationships);
router.post('/insights', analysisController.getInsights);

module.exports = router;
