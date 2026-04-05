const express = require('express');
const router  = express.Router();
const sc      = require('../controllers/studentController');

router.get('/',                        sc.list);
router.get('/stats',                   sc.stats);
router.get('/folder-structure',        sc.folderStructure);
router.get('/verify-drive-stream',     sc.verifyAgainstDriveStream);
router.post('/',                       sc.create);
router.post('/verify-row',             sc.verifyRow);
router.post('/verify-against-drive',   sc.verifyAgainstDrive);
router.post('/extract-bulk',           sc.extractBulk);
router.post('/extract/:analysisId',    sc.extractFromAnalysis);
router.put('/:id',                     sc.update);
router.delete('/:id',                  sc.remove);

module.exports = router;
