// models/Notification.js

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    organization: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Organization', 
        required: true 
    },
    type: {
        type: String,
        enum: ['form_submission', 'api_keys_generated', 'password_changed', 'new_member', 'form_created'],
        required: true
    },
    message: { 
        type: String, 
        required: true 
    },
    link: { 
        type: String 
    }, // e.g., /forms/formId/submissions/submissionId
    isRead: { 
        type: Boolean, 
        default: false 
    },
}, { timestamps: true });

const Notification = mongoose.model('Notification', NotificationSchema);
module.exports = Notification;