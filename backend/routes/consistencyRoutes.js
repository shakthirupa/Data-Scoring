const express = require('express');
const router = express.Router();
const c = require('../controllers/consistencyController');

router.get('/rules',                        c.listRules);
router.post('/rules',                       c.addRule);
router.delete('/rules/:ruleId',             c.removeRule);
router.put('/rules/:ruleId/toggle',         c.toggleRule);

router.post('/validate/:analysisId',        c.validate);
router.post('/validate-inline',             c.validateInline);
router.get('/result/:analysisId',           c.getResult);

module.exports = router;
