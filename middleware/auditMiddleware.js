const AuditLog = require('../models/AuditLog');
const asyncHandler = require('express-async-handler');

const audit = (action, resourceType) => asyncHandler(async (req, res, next) => {
    next();

    res.on('finish', async () => {
        try {
            const details = {
                body: req.body,
                params: req.params,
                query: req.query,
                ...(res.locals.auditDetails || {}) 
            };
            let resourceId = req.params.id || (req.body && req.body.formId);
            let failureReason = null;
            
            // If the response status code indicates an error, capture the reason
            if (res.statusCode >= 400) {
                failureReason = res.locals.errorMessage || 'An error occurred';
            }
              if (res.locals.resourceId) {
                resourceId = res.locals.resourceId;
            }

            const log = new AuditLog({
                organization: req.user ? req.user.currentOrganization : null,
                user: req.user ? req.user._id : null,
                action,
                resourceType,
                resourceId,
                ip: req.ip,
                userAgent: req.get('user-agent'),
                success: res.statusCode < 400,
                failureReason,
                details
            });

            await log.save();
        } catch (error) {
            console.error('Failed to create audit log:', error);
        }
    });
});

module.exports = audit;