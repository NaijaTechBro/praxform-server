const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
    form: { type: mongoose.Schema.Types.ObjectId, ref: 'Form', required: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    data: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    encryptedData: { type: Map, of: String, default: {} },
    files: [{
        fieldId: String,
        fileName: String,
        fileType: String,
        fileSize: Number,
        publicId: String, // Cloudinary ID
        recipientEmail: { type: String },
        url: String
    }],
    status: { type: String, enum: ['complete', 'partial', 'flagged'], default: 'complete' },
    expiresAt: { type: Date }
}, { timestamps: true });

// TTL index for auto-deletion of submissions
SubmissionSchema.index({ "expiresAt": 1 }, { expireAfterSeconds: 0 });

const Submission = mongoose.model('Submission', SubmissionSchema);
module.exports = Submission;