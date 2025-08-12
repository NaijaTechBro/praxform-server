const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    resourceType: { type: String },
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: mongoose.Schema.Types.Mixed },
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now }
}, { timestamps: false });

// TTL index for auto-cleanup of logs
AuditLogSchema.index({ "timestamp": 1 }, { expireAfterSeconds: 15552000 }); // 180 days 

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
module.exports = AuditLog;