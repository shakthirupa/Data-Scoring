const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/stats', dashboardController.getDashboardStats);
router.get('/trends', dashboardController.getTrends);
router.get('/issues', dashboardController.getIssuesSummary);
router.patch('/issues/:id/resolve', dashboardController.resolveIssue);
router.get('/notifications', dashboardController.getNotifications);

module.exports = router;
