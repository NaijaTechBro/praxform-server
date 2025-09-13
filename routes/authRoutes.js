// const express = require('express');
// const router = express.Router();
// const {
//     registerUser,
//     loginUser,
//     googleAuth,
//     requestLoginCode,
//     loginWithCode,
//     getMe,
//     resendVerification,
//     verifyEmail,
//     forgotPassword,
//     resetPassword,
//     changePassword,
//     logout,
//     refreshToken, 
// } = require('../controllers/authController');
// const { protect } = require('../middleware/authMiddleware');
// const audit = require('../middleware/auditMiddleware');

// // === Public Authentication Routes ===

// // Standard Registration & Login
// router.post('/register', audit('user.created', 'user'), registerUser);
// router.post('/login', audit('user.login', 'user'), loginUser);

// // Social & Code-Based Login
// router.post('/google', audit('user.login.google', 'user'), googleAuth);
// router.post('/request-code', requestLoginCode);
// router.post('/login-code', audit('user.login.code', 'user'), loginWithCode);

// // Account Management & Recovery
// router.post('/resend-verification', resendVerification);
// router.get('/verifyemail/:code', verifyEmail);
// router.post('/forgot-password', forgotPassword);
// router.put('/reset-password/:resetToken', resetPassword);

// // Session Management
// router.post('/refresh-token', refreshToken);
// router.post('/logout', logout);

// // === Protected Routes (Require Authentication) ===
// router.use(protect);

// router.get('/me', getMe);
// router.put('/change-password', audit('user.password_changed', 'user'), changePassword);


// module.exports = router;


const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    verifyMfa, // <-- Updated
    googleAuth,
    getMe,
    resendVerification,
    verifyEmail,
    forgotPassword,
    resetPassword,
    changePassword,
    logout,
    refreshToken, 
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const audit = require('../middleware/auditMiddleware');

// Public Routes
router.post('/register', audit('user.created', 'user'), registerUser);
router.post('/login', audit('user.login', 'user'), loginUser);
router.post('/verify-mfa', verifyMfa);
router.post('/google', googleAuth);
router.post('/resend-verification', resendVerification);
router.post('/logout', logout);
router.get('/verifyemail/:code', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resetToken', resetPassword);

// New Public Route for Token Refresh
router.post('/refresh-token', refreshToken);

// Protected Routes
router.get('/me', protect, getMe);
router.put('/change-password', protect, audit('user.password_changed', 'user'), changePassword);

module.exports = router;

