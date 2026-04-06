const express = require('express');
const router = express.Router();
const { showForm, submitForm } = require('../controllers/updateController');

router.get('/:token', showForm);
router.post('/:token', submitForm);

module.exports = router;
