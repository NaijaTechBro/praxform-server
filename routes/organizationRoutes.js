const express = require('express');
const router = express.Router();
const { getOrganizationById, updateOrganization } = require('../controllers/organizationController');
const { protect } = require('../middleware/authMiddleware');

// In a multi-tenant app, you might not list all organizations.
// Instead, you'd have a route like /api/v1/users/me/organizations
router.route('/:id').get(protect, getOrganizationById).put(protect, updateOrganization);

module.exports = router;