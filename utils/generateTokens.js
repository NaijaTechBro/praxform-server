const jwt = require('jsonwebtoken');

/**
 * Generates both an access and a refresh token for a user.
 * @param {string} userId - The user's MongoDB ObjectId.
 * @returns {{accessToken: string, refreshToken: string}}
 */
const generateTokens = (userId) => {
    // The payload uses 'id' to match what the 'protect' middleware expects.
    const payload = {
        id: userId,
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    });

    return { accessToken, refreshToken };
};

module.exports = { generateTokens };