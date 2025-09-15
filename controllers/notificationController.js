
const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');

// @desc    Get all notifications for the current user
// @route   GET /api/v1/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ 
        user: req.user._id,
        organization: req.user.currentOrganization
    }).sort({ createdAt: -1 }).limit(20); // Get latest 20

    const unreadCount = await Notification.countDocuments({
        user: req.user._id,
        organization: req.user.currentOrganization,
        isRead: false
    });

    res.status(200).json({
        success: true,
        count: notifications.length,
        unreadCount,
        data: notifications
    });
});

// @desc    Mark a notification as read
// @route   PUT /api/v1/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification || notification.user.toString() !== req.user._id.toString()) {
        res.status(404);
        throw new Error('Notification not found');
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ success: true, data: notification });
});


// @desc    Mark all notifications as read
// @route   PUT /api/v1/notifications/read-all
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
    await Notification.updateMany(
        { user: req.user._id, organization: req.user.currentOrganization, isRead: false },
        { $set: { isRead: true } }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read.' });
});


module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead
};