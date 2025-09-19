const mongoose = require('mongoose');

const OrganizationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true },
    industry: { type: String, trim: true },
    logo: { url: String, publicId: String },
    website: { type: String, trim: true },
    address: { street: String, city: String, state: String, zip: String, country: String },
    phoneNumber: { type: Number, trim: true },
    email: { type: String, trim: true, lowercase: true },
    
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected', 'conflict', 'unverified'],
        default: 'unverified',
        required: true
    },

    members: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'admin', 'manager', 'viewer'], default: 'viewer' }
    }],
    callbackUrl: { type: String, trim: true },
    plan: {
    type: String,
    enum: ['starter', 'pro', 'business'],
    default: 'starter',
},
// Payment details
subscriptionId: { 
    type: String,
    default: null,
},
customerId: { 
    type: String,
    default: null,
},
subscriptionStatus: {
    type: String,
    enum: ['active', 'canceled', 'incomplete', 'past_due', null],
    default: null,
},
currentPeriodEnd: { 
    type: Date,
    default: null,
},

planLimits: {
    maxTeamMembers: { type: Number, default: 1 },
    maxForms: { type: Number, default: 5 },
    maxSubmissionsPerMonth: { type: Number, default: 50 },
    maxTemplates: { type: Number, default: 3 },
},
    apiKeys: [{
        name: String,
        key: String, 
        permissions: [String],
        lastUsed: Date,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        expiresAt: Date
    }],
    webhooks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Webhook' }]
},

{ timestamps: true });

const Organization = mongoose.model('Organization', OrganizationSchema);
module.exports = Organization;