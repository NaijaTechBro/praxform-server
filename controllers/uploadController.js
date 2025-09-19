const asyncHandler = require('express-async-handler');
const cloudinary = require('../config/cloudinary');

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

  // Generate the signature using the Cloudinary SDK
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp: timestamp,
      folder: folder,
    },
    process.env.CLOUDINARY_API_SECRET
  );

  res.status(200).json({
    timestamp,
    signature,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
  });
});

module.exports = { generateSignature };