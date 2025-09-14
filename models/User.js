const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: function() { return this.authMethod === 'local'; } },
    authMethod: { type: String, enum: ['local', 'google', 'microsoft', 'magic-link'], default: 'local' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phoneNumber: { type: Number, trim: true },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    mfaEnabled: { type: Boolean, default: false },
    mfaMethod: { type: String, enum: ['app', 'sms', null], default: null },
    mfaSecret: { type: String, select: false },
    lastLogin: { type: Date },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    organizations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Organization' }],
    currentOrganization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    preferences: {
        theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true }
        }
    },
    emailVerificationToken: String,
    emailVerificationTokenExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    loginCode: String,
    loginCodeExpires: Date,
    metadata: { type: Map, of: String }
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
    if (this.isModified('passwordHash') && this.authMethod === 'local' && this.passwordHash) {
        const salt = await bcrypt.genSalt(10);
        this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    }
    next();
});

UserSchema.methods.matchPassword = async function(enteredPassword) {
    // Only compare if passwordHash exists (for local auth)
    if (this.passwordHash) {
        return await bcrypt.compare(enteredPassword, this.passwordHash);
    }
    return false; // If no passwordHash, cannot match
};

const User = mongoose.model('User', UserSchema);
module.exports = User;
