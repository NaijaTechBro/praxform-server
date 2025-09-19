const express = require('express');
const router = express.Router();
const { generateSignature } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');

// This route is protected, only authenticated users can get a signature
router.post('/signature', protect, generateSignature);

module.exports = router;