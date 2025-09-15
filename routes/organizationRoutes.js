const express = require('express');
const router = express.Router();
// --- Import the new function ---
const { 
    getOrganizationById, 
    updateOrganization, 
    generateApiKeys 
} = require('../controllers/organizationController');
const { protect } = require('../middleware/authMiddleware');

router.route('/:id')
    .get(protect, getOrganizationById)
    .put(protect, updateOrganization);

router.route('/:id/api-keys')
    .post(protect, generateApiKeys);

module.exports = router;