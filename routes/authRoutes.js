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
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const audit = require('../middleware/auditMiddleware');

// Public Routes
router.post('/register', audit('user.created', 'user'), registerUser);
router.post('/login', audit('user.login', 'user'), loginUser); // Logs login attempts
router.post('/resendverification', resendVerification);
router.get('/verifyemail/:code', verifyEmail);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:token', resetPassword);

// Protected Routes
router.get('/me', protect, getMe);

module.exports = router;
