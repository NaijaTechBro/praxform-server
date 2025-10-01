const express = require('express');
const router = express.Router();
const passport = require('passport');
const {
    registerUser,
    loginUser,
    verifyMfa,
    getMe,
    resendVerification,
    verifyEmail,
    forgotPassword,
    resetPassword,
    changePassword,
    logout,
    refreshToken,
    googleAuthCallback,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const audit = require('../middleware/auditMiddleware');

// Public Routes
router.post('/register', audit('user.created', 'user'), registerUser);
router.post('/login', audit('user.login', 'user'), loginUser);
router.post('/verify-mfa', verifyMfa);
router.post('/resend-verification', resendVerification);
router.post('/logout', logout);
router.get('/verifyemail/:code', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resetToken', resetPassword);
router.post('/refresh-token', refreshToken);

// Route to initiate Google authentication
router.get('/google', (req, res, next ) => {
    const state = req.query.state;

    const authenticator = passport.authenticate('google', {
        scope: ['profile', 'email'],
        state: state
    })
    authenticator(req, res, next);
});

// The callback route that Google redirects to
router.get(
    '/google/callback',
    passport.authenticate('google', {
        failureRedirect: `${process.env.PRAXFORM_FRONTEND_HOST}/login?error=google-auth-failed`,
        session: false
    }),
    googleAuthCallback // This runs only on success
);

// --- Protected Routes ---
router.get('/me', protect, getMe);
router.put('/change-password', protect, audit('user.password_changed', 'user'), changePassword);

module.exports = router;