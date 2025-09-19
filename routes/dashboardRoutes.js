const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

// This single route provides all the stats for the dashboard homepage
router.get('/stats', protect, getDashboardStats);

module.exports = router;