const express = require('express');
const router = express.Router();
const { 
    generateSignature,
    generatePublicSignature,

 } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');

// This route is protected, only authenticated users can get a signature
router.post('/signature', protect, generateSignature);

router.post('/public-signature', generatePublicSignature);

module.exports = router;