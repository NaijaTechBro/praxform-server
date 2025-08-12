const AuditLog = require('../models/AuditLog');
const asyncHandler = require('express-async-handler');

const audit = (action, resourceType) => asyncHandler(async (req, res, next) => {
    // Let the actual route handler run first
    next();

    // The handler is finished, now we can log the result.
    // We wrap this in a listener for the 'finish' event on the response object.
    res.on('finish', async () => {
        try {
            let resourceId = req.params.id || (req.body && req.body.formId);
            let failureReason = null;
            
            // If the response status code indicates an error, capture the reason
            if (res.statusCode >= 400) {
                // In your errorHandler middleware, you can attach the error message to res.locals
                failureReason = res.locals.errorMessage || 'An error occurred';
            }

            // In a real implementation, the created resource ID might be on req.locals
            // For example, after creating a form, the controller could set req.locals.resourceId = createdForm._id
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
                details: {
                    body: req.body,
                    params: req.params,
                    query: req.query
                },
            });

            await log.save();
        } catch (error) {
            console.error('Failed to create audit log:', error);
        }
    });
});

module.exports = audit;