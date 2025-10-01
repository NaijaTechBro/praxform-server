//middleware/authorizeMiddleware.js
const asyncHandler = require('express-async-handler');
const Organization = require('../models/Organization');

const authorize = (...roles) => asyncHandler(async (req, res, next) => {
    // ✨ Add this bypass at the top
    if (req.user && req.user.role === 'superadmin') {
        return next();
    }

    if (!req.user || !req.user.currentOrganization) {
        res.status(403);
        throw new Error('Not authorized to access this route');
    }

    const organization = await Organization.findById(req.user.currentOrganization);
    if (!organization) {
        res.status(403);
        throw new Error('Organization not found');
    }

    const member = organization.members.find(m => m.userId.equals(req.user._id));
    if (!member || !roles.includes(member.role)) {
        res.status(403);
        const userRole = member ? member.role : 'none';
        throw new Error(`User role '${userRole}' is not authorized to access this route`);
    }

    next();
});

module.exports = authorize;