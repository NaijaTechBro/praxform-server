const mongoose = require('mongoose');

const FormTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    isPublic: { type: Boolean, default: false },
    category: { type: String, enum: ['payment', 'tax', 'onboarding', 'consent', 'survey', 'other'], default: 'other' },
    fields: { type: Array, default: [] }, // Simplified for brevity
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const FormTemplate = mongoose.model('FormTemplate', FormTemplateSchema);
module.exports = FormTemplate;