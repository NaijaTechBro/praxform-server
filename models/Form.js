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
        phone: String,
        uniqueAccessCode: String,
        status: { type: String, enum: ['pending', 'viewed', 'completed'], default: 'pending' },
        verificationCode: { type: String },
        verificationCodeExpires: { type: Date }
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

FormSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
    console.log(`Deleting submissions for form: ${this._id}`);
    await this.model('Submission').deleteMany({ form: this._id });
    next();
});

const Form = mongoose.model('Form', FormSchema);
module.exports = Form;