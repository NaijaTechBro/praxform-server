const cloudinary = require('../config/cloudinary');
const validator = require('validator'); 

/**
 * Uploads an external image URL to Cloudinary, serving as a secure proxy.
 */
const uploadExternalImageToCloudinary = async (externalUrl, folder = 'avatars') => {
    // This line throws the error if 'validator' is not imported above
    if (!validator.isURL(externalUrl, { require_protocol: true, protocols: ['http', 'https'] })) {
        console.error('SSRF Defense: Invalid or non-public URL rejected.', externalUrl);
        return null;
    }
    
    try {
        const result = await cloudinary.uploader.upload(externalUrl, {
            folder: folder, 
            resource_type: 'image',
        });

        return {
            public_id: result.public_id, 
            url: result.secure_url
        }; 
    } catch (error) {
        console.error('Cloudinary upload failed for external URL:', error);
        return null; 
    }
};

const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error(`Failed to delete ${publicId} from Cloudinary.`, error);
  }
};

module.exports = { 
    deleteFromCloudinary,
    uploadExternalImageToCloudinary
};
