// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const {
    getPlans,
    createCheckoutSession,
    getCustomerPortal,
    handleStripeWebhook
} = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Authenticated routes
router.get('/plans', protect, getPlans);
router.post('/create-checkout-session', protect, createCheckoutSession);
router.get('/customer-portal', protect, getCustomerPortal);

// Public webhook route
// Use express.raw for the Stripe webhook to verify the signature
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;