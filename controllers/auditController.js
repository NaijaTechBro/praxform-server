const asyncHandler = require('express-async-handler');
const AuditLog = require('../models/AuditLog');

// @desc    Get all audit logs for an organization
// @route   GET /api/v1/audit-logs
// @access  Private
const getAuditLogs = asyncHandler(async (req, res) => {
    const organizationId = req.user.currentOrganization;
    const logs = await AuditLog.find({ organization: organizationId })
        .populate('user', 'firstName lastName')
        .sort({ timestamp: -1 });

    res.json(logs);
});

module.exports = { getAuditLogs };