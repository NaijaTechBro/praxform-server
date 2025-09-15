const express = require('express');
const router = express.Router();
const { getOrganizationById, updateOrganization } = require('../controllers/organizationController');
const { protect } = require('../middleware/authMiddleware');


router.route('/:id')
    .get(protect, getOrganizationById)
    .put(protect, updateOrganization);

module.exports = router;