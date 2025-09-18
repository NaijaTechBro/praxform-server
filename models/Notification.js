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
        required: true,
        enum: [
            'form_submission',
            'form_update',
            'form_deleted',
            'form_created',
            'api_keys_generated',
            'password_changed',
            'new_member',
            'plan_upgrade',
            'payment_failed',
            'organization_update'
        ]
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