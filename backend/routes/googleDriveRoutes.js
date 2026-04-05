const express = require('express');
const router  = express.Router();
const dc      = require('../controllers/googleDriveController');
const auth    = require('../middleware/auth');

router.get('/service-email',      dc.getServiceEmail);
router.get('/connections',        auth, dc.getConnections);
router.get('/job/:jobId',         dc.getJobProgress);
router.post('/connect',           auth, dc.saveConnection);
router.post('/browse',            dc.browse);
router.post('/import-folder',     dc.importFolder);
router.post('/import',            dc.importFile);

module.exports = router;
