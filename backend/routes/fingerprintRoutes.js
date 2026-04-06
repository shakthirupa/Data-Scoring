const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const fp = require('../controllers/fingerprintController');

router.use(auth);

router.get('/all',                    fp.getAll);
router.get('/duplicates',             fp.getDuplicates);
router.get('/similar/:analysisId',    fp.getSimilar);
router.get('/:analysisId',            fp.getFingerprint);
router.post('/compare',               fp.compare);

module.exports = router;
