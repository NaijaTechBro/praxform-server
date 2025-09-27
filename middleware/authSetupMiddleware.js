const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const verifySetupToken = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify the token using the same JWT secret
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from the token's ID and attach it to the request object
            req.user = await User.findById(decoded.id).select('-passwordHash');

            if (!req.user) {
                res.status(401);
                throw new Error('Not authorized, user for this token not found');
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401);
            throw new Error('Not authorized, token failed or expired');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no setup token provided');
    }
});

module.exports = { verifySetupToken };