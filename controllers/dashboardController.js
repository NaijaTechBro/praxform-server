const asyncHandler = require('express-async-handler');
const Form = require('../models/Form');
const Submission = require('../models/Submission');

// @desc      Get aggregated statistics for the dashboard
// @route     GET /api/v1/dashboard/stats
// @access    Private
const getDashboardStats = asyncHandler(async (req, res) => {
    const organizationId = req.user.currentOrganization;

    // Use Promise.all to run database queries in parallel for better performance
    const [
        totalForms,
        activeForms,
        draftForms,
        totalSubmissions
    ] = await Promise.all([
        Form.countDocuments({ organization: organizationId }),
        Form.countDocuments({ organization: organizationId, status: 'active' }),
        Form.countDocuments({ organization: organizationId, status: 'draft' }),
        Submission.countDocuments({ organization: organizationId })
    ]);

    res.status(200).json({
        totalForms,
        activeForms,
        draftForms,
        totalSubmissions,
    });
});

module.exports = { getDashboardStats };