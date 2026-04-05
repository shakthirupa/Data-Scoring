const express = require('express');
const router = express.Router();
const multer = require('multer');
const analysisController = require('../controllers/analysisController');

const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('file'), analysisController.uploadFile);
router.post('/sheets', upload.single('file'), analysisController.getSheets);
router.post('/upload-url', analysisController.uploadFromUrl);
router.get('/history', analysisController.getHistory);
router.delete('/all', analysisController.deleteAllAnalyses);
router.patch('/:id/verification', analysisController.saveVerificationStatus);
router.delete('/:id', analysisController.deleteAnalysis);
router.get('/:id', analysisController.getAnalysisById);
router.post('/insights', analysisController.getInsights);

module.exports = router;
