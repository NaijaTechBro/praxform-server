const express = require('express');
const router = express.Router();
const { getPlatformStats } = require('../controllers/admin/superAdminController');

const { protect } = require('../middleware/authMiddleware');
const { superAdmin } = require('../middleware/superAdmin');

// All routes in this file will first be protected, then checked for superadmin role
router.use(protect, superAdmin);

// Define the route for the stats dashboard
router.route('/stats').get(getPlatformStats);

module.exports = router;