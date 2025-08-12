const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true },
    industry: { type: String, trim: true },
    logo: { url: String, publicId: String },
    website: { type: String, trim: true },
    address: { street: String, city: String, state: String, zip: String, country: String },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    isVerified: { type: Boolean, default: false },
    members: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'admin', 'manager', 'viewer'], default: 'viewer' }
    }],
    apiKeys: [{
        name: String,
        key: String, // Hashed
        permissions: [String],
        lastUsed: Date,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        expiresAt: Date
    }],
    webhooks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Webhook' }]
}, { timestamps: true });

const Organization = mongoose.model('Organization', OrganizationSchema);
module.exports = Organization;