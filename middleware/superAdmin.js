const asyncHandler = require('express-async-handler');

const superAdmin = asyncHandler(async (req, res, next) => {
    // This middleware runs after 'protect', so req.user will exist.
    if (req.user && req.user.role === 'superadmin') {
        next();
    } else {
        res.status(403); // Forbidden
        throw new Error('Not authorized. Super admin access required.');
    }
});

module.exports = { superAdmin };