const asyncHandler = require('express-async-handler');
const Organization = require('../models/Organization');

const authorizeMiddleware = (...roles) => asyncHandler(async (req, res, next) => {
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
        throw new Error(`User role '${member.role}' is not authorized to access this route`);
    }

    next();
});

module.exports = authorizeMiddleware;