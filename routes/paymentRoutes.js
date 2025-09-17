// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const {
    getPlans,
    createCheckoutSession,
    getCustomerPortal
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Authenticated routes
router.get('/plans', protect, getPlans);
router.post('/create-checkout-session', protect, createCheckoutSession);
router.get('/customer-portal', protect, getCustomerPortal);

module.exports = router;