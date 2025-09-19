const asyncHandler = require('express-async-handler');
const cloudinary = require('../config/cloudinary');
const Form = require('../models/Form');

// @desc      Generate a signature for direct Cloudinary upload
// @route     POST /api/v1/uploads/signature
// @access    Private
const generateSignature = asyncHandler(async (req, res) => {
  const { folder } = req.body;

  if (!folder) {
    res.status(400);
    throw new Error('Folder parameter is required');
  }

  const timestamp = Math.round(new Date().getTime() / 1000);

  const uploadPreset = 'praxform_public_uploads';
  // Generate the signature using the Cloudinary SDK
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp: timestamp,
      folder,
      upload_preset: uploadPreset
    },
    process.env.CLOUDINARY_API_SECRET
  );

  res.status(200).json({
    timestamp,
    signature,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
    uploadPreset
  });
});


// @desc      Generate a signature for a public upload
// @route     POST /api/v1/uploads/public-signature
// @access    Public
const generatePublicSignature = asyncHandler(async (req, res) => {
    const { folder, formId, accessCode } = req.body;

    if (!folder || !formId || !accessCode) {
        res.status(400);
        throw new Error('Folder, Form ID, and Access Code are required');
    }

    // Security Check: Validate that the access code is valid for this form
    const form = await Form.findById(formId);
    if (!form) {
        res.status(404);
        throw new Error('Form not found');
    }
    const recipient = form.recipients.find((r) => r.uniqueAccessCode === accessCode);
    const isPublicLink = form.publicLink?.enabled && form.publicLink?.uniqueAccessCode === accessCode;
    if (!recipient && !isPublicLink) {
        res.status(403);
        throw new Error('Invalid or expired access code');
    }
    // End Security Check

    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET);

    res.status(200).json({
        timestamp,
        signature,
        folder,
        apiKey: process.env.CLOUDINARY_API_KEY,
    });
});


module.exports = { 
  generateSignature,
  generatePublicSignature
 };