const express = require('express');
const router = express.Router();
const fc = require('../controllers/forensicsController');

router.post('/inline',                        fc.inlineForensics);
router.get('/:analysisId',                    fc.getReport);
router.post('/:analysisId/recompute',         fc.recompute);
router.get('/:analysisId/timeline',           fc.getTimeline);
router.get('/:analysisId/column/:column',     fc.getColumnReport);

module.exports = router;
