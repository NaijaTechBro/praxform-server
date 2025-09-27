const express = require('express');
const router = express.Router();

const { 
    getOrganizationById, 
    updateOrganization, 
    generateApiKeys,
    inviteMember,
    removeMember,
    updateOrganizationLogo,
    setupGoogleUser,

} = require('../controllers/organizationController');


const { protect } = require('../middleware/authMiddleware');
const { verifySetupToken } = require('../middleware/authSetupMiddleware')

router.post('/setup-google-user', verifySetupToken, setupGoogleUser);

router.put('/:id/logo', protect, updateOrganizationLogo);

router.route('/:id')
    .get(protect, getOrganizationById)
    .put(protect, updateOrganization);

router.route('/:id/api-keys')
    .post(protect, generateApiKeys);

router.post('/:id/members', protect, inviteMember);
router.delete('/:id/members/:memberId', protect, removeMember);

module.exports = router;