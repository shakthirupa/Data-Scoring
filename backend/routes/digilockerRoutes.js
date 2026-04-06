const express = require('express');
const router = express.Router();
const dc = require('../controllers/digilockerController');

// Integration settings — static routes BEFORE param routes
router.post('/integration/save',           dc.saveIntegration);
router.get('/integration/orgs',            dc.listOrgs);
router.get('/integration/status/:orgId',   dc.getIntegrationStatus);
router.get('/integration/:orgId',          dc.getIntegration);

// Verification — static routes BEFORE param routes
router.post('/verify/mock',                dc.verifyMock);
router.post('/verify/live',                dc.verifyLive);
router.post('/verify',                     dc.verify);
router.post('/verify/dataset/:analysisId', dc.verifyDataset);
router.get('/verify/mock-data',            dc.getMockData);
router.get('/verify/history/:orgId',       dc.getHistory);

// OAuth flow (live mode)
router.get('/verify/oauth/redirect/:orgId', dc.oauthRedirect);
router.get('/verify/oauth/callback',        dc.oauthCallback);

module.exports = router;
