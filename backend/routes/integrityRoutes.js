const express = require('express');
const router = express.Router();
const ic = require('../controllers/integrityController');

router.get('/',                              ic.predictAll);
router.get('/groups',                        ic.listGroups);
router.get('/alerts',                        ic.getAlerts);
router.get('/snapshots/:fileGroup',          ic.getSnapshots);
router.get('/by-analysis/:analysisId',       ic.predictByAnalysis);
router.get('/:fileGroup',                    ic.predictGroup);

module.exports = router;
