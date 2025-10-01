// const User = require('../models/User');
// const { generateTokens } = require('./generateTokens');

// // Helper to parse expiration time from a string like "7d"
// const parseExpiry = (expiryString) => {
//     if (!expiryString) return 86400000; // Default to 1 day
//     const num = parseInt(expiryString);
//     const unit = expiryString.slice(-1);
//     switch (unit) {
//         case 'd': return num * 24 * 60 * 60 * 1000;
//         case 'h': return num * 60 * 60 * 1000;
//         case 'm': return num * 60 * 1000;
//         case 's': return num * 1000;
//         default: return num;
//     }
// };

// // This function creates tokens, sets the cookie, and sends the final JSON response.
// const sendTokenResponse = async (user, statusCode, res) => {
//     const { accessToken, refreshToken } = generateTokens(user._id);
//     const populatedUser = await User.findById(user._id).populate('currentOrganization', 'name logo');
//     const cookieExpiryMs = parseExpiry(process.env.JWT_REFRESH_EXPIRY);

//     const cookieOptions = {
//         expires: new Date(Date.now() + cookieExpiryMs),
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'strict', // Or 'none' if your frontend and backend are on different domains
//         path: '/api/v1/auth/refresh-token'
//     };

//     res.cookie('refreshToken', refreshToken, cookieOptions);

//     res.status(statusCode).json({
//         success: true,
//         user: {
//             _id: populatedUser._id,
//             firstName: populatedUser.firstName,
//             lastName: populatedUser.lastName,
//             email: populatedUser.email,
//             currentOrganization: populatedUser.currentOrganization,
//             avatar: populatedUser.avatar,
//             preferences: populatedUser.preferences,
//             mfaEnabled: populatedUser.mfaEnabled,
//         },
//         accessToken,
//     });
// };

// module.exports = { sendTokenResponse };



const User = require('../models/User');
const { generateTokens } = require('./generateTokens');

const parseExpiry = (expiryString) => {
    if (!expiryString) return 86400000; // Default to 1 day
    const num = parseInt(expiryString);
    const unit = expiryString.slice(-1);
    switch (unit) {
        case 'd': return num * 24 * 60 * 60 * 1000;
        case 'h': return num * 60 * 60 * 1000;
        case 'm': return num * 60 * 1000;
        case 's': return num * 1000;
        default: return num;
    }
};

const sendTokenResponse = async (user, statusCode, res) => {
    const { accessToken, refreshToken } = generateTokens(user._id);
    const populatedUser = await User.findById(user._id).populate('currentOrganization', 'name logo');
    const cookieExpiryMs = parseExpiry(process.env.JWT_REFRESH_EXPIRY);

    const cookieOptions = {
        expires: new Date(Date.now() + cookieExpiryMs),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth/refresh-token'
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.status(statusCode).json({
        success: true,
        user: {
            _id: populatedUser._id,
            firstName: populatedUser.firstName,
            lastName: populatedUser.lastName,
            email: populatedUser.email,
            currentOrganization: populatedUser.currentOrganization,
            avatar: populatedUser.avatar,
            preferences: populatedUser.preferences,
            mfaEnabled: populatedUser.mfaEnabled,
            mfaMethod: populatedUser.mfaMethod, 
        },
        accessToken,
    });
};

module.exports = { sendTokenResponse };

