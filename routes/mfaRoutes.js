const express = require('express');
const router = express.Router();
const {
    reauthenticate,
    setupGoogleAuthenticator,
    verifyGoogleAuthenticator,
    disableMfa
} = require('../controllers/multiFactorAuthController');

const { protect } = require('../middleware/authMiddleware');
router.use(protect);

router.post('/reauthenticate', reauthenticate);

router.post('/setup-google', setupGoogleAuthenticator);
router.post('/verify-google', verifyGoogleAuthenticator);
router.put('/disable', disableMfa);

module.exports = router;