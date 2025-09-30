const express = require('express');
const router = express.Router();
const { submitInquiry } = require('../controllers/contactController');
const { submitDemoRequest } = require('../controllers/demoRequestController');

router.post('/contact', submitInquiry);

router.post('/demos', submitDemoRequest);

module.exports = router;