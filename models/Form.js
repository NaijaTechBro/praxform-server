const mongoose = require('mongoose');

const FormSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'FormTemplate' },
    fields: { type: Array, default: [] },
    status: { type: String, enum: ['draft', 'active', 'paused', 'archived'], default: 'draft' },
    recipients: [{
        email: String,
        name: String,
        phone: String, // Added for SMS auth
        uniqueAccessCode: String,
        status: { type: String, enum: ['pending', 'viewed', 'completed'], default: 'pending' },
        // --- START OF FIX: Fields for 2FA ---
        verificationCode: { type: String },
        verificationCodeExpires: { type: Date }
        // --- END OF FIX ---
    }],
    submissionCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    encryptionKey: { type: String, required: false },
    settings: {
        oneTimeUse: { type: Boolean, default: false },
        requireSmsAuth: { type: Boolean, default: false },
        requireEmailAuth: { type: Boolean, default: false },
        dueDate: { type: Date, default: null }
    },
    publicLink: {
        enabled: { type: Boolean, default: false },
        uniqueAccessCode: { type: String, unique: true, sparse: true }
    }
}, { timestamps: true });

const Form = mongoose.model('Form', FormSchema);
module.exports = Form;