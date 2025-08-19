const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getMe,
    resendVerification,
    verifyEmail,
    forgotPassword,
    resetPassword,
    changePassword,
    logout,
    
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const audit = require('../middleware/auditMiddleware');

// Public Routes
router.post('/register', audit('user.created', 'user'), registerUser);
router.post('/login', audit('user.login', 'user'), loginUser); // Logs login attempts
router.post('/resend-verification', resendVerification);
router.get('/logout', logout)
router.get('/verifyemail/:code', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:resetToken', resetPassword);
router.put('/change-password', protect, audit('user.password_changed', 'user'), changePassword);

// Protected Routes
router.get('/me', protect, getMe);

module.exports = router;
