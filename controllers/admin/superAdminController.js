const asyncHandler = require('express-async-handler');
const User = require('../../models/User');
const Organization = require('../../models/Organization');
const Form = require('../../models/Form');
const Submission = require('../../models/Submission');
const BlogPost = require('../../models/BlogPost');

// @desc      Get platform-wide statistics
// @route     GET /api/v1/superadmin/stats
// @access    Private/SuperAdmin
const getPlatformStats = asyncHandler(async (req, res) => {
    
    // Run all counting operations in parallel for performance
    const [
        totalUsers,
        totalOrganizations,
        totalForms,
        totalSubmissions,
        totalBlogPosts
    ] = await Promise.all([
        User.countDocuments(),
        Organization.countDocuments(),
        Form.countDocuments(),
        Submission.countDocuments(),
        BlogPost.countDocuments()
    ]);

    res.status(200).json({
        success: true,
        data: {
            totalUsers,
            totalOrganizations,
            totalForms,
            totalSubmissions,
            totalBlogPosts,
        }
    });
});

module.exports = {
    getPlatformStats,
};