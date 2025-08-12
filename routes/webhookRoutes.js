const express = require('express');
const router = express.Router();
const { 
    createWebhook, 
    getWebhooks, 
    updateWebhook, 
    deleteWebhook 
} = require('../controllers/webhookController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(protect, createWebhook).get(protect, getWebhooks);
router.route('/:id').put(protect, updateWebhook).delete(protect, deleteWebhook);

module.exports = router;