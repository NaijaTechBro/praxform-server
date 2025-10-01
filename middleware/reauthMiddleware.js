const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');

const protectWithReauth = asyncHandler(async (req, res, next) => {
    let token;
    const reauthHeader = req.headers['x-reauth-token'];

    if (reauthHeader) {
        try {
            token = reauthHeader;
            const decoded = jwt.verify(token, process.env.JWT_REAUTH_SECRET);

            // Check if the token's purpose is correct
            if (decoded.purpose !== 're-authentication') {
                res.status(401);
                throw new Error('Not authorized, invalid token purpose');
            }
            
            // We don't need to attach the user again since the main 'protect' middleware already did.
            // This middleware just acts as a gate.
            next();
        } catch (error) {
            console.error(error);
            res.status(401);
            throw new Error('Not authorized, re-authentication token failed or expired');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no re-authentication token provided');
    }
});

module.exports = { protectWithReauth };