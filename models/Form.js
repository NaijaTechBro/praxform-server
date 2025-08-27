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
        uniqueAccessCode: String,
        status: { type: String, enum: ['pending', 'viewed', 'completed'], default: 'pending' }
    }],
    submissionCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    encryptionKey: { type: String, required: false } 
}, { timestamps: true });

const Form = mongoose.model('Form', FormSchema);
module.exports = Form;