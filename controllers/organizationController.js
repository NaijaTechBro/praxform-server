const asyncHandler = require('express-async-handler');
const Organization = require('../models/Organization');
const User = require('../models/User'); 
const crypto = require('crypto');     
const bcrypt = require('bcryptjs');  
const createNotification = require('../utils/createNotification');
const triggerWebhook = require('../utils/triggerWebhook');

// @desc    Get organization details
// @route   GET /api/v1/organizations/:id
// @access  Private
const getOrganizationById = asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.params.id).populate('members.userId', 'firstName lastName email');
    if (!organization) {
        res.status(404);
        throw new Error('Organization not found');
    }
    const isMember = organization.members.some(member => member.userId._id.equals(req.user._id));
    if (!isMember) {
        res.status(403);
        throw new Error('User is not authorized to view this organization');
    }
    res.json(organization);
});

// @desc    Update organization details
// @route   PUT /api/v1/organizations/:id
// @access  Private/Owner or Admin
// @desc      Update organization details
// @route     PUT /api/v1/organizations/:id
// @access    Private/Owner or Admin
const updateOrganization = asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
        res.status(404);
        throw new Error('Organization not found');
    }

    const member = organization.members.find(member => member.userId.equals(req.user._id));
    if (!member || !['owner', 'admin'].includes(member.role)) {
        res.status(403);
        throw new Error('User does not have permission to update this organization');
    }

    const { name, description, industry, website, phoneNumber, email, address, callbackUrl } = req.body;

    organization.name = name ?? organization.name;
    organization.description = description ?? organization.description;
    organization.industry = industry ?? organization.industry;
    organization.website = website ?? organization.website;
    organization.phoneNumber = phoneNumber ?? organization.phoneNumber;
    organization.email = email ?? organization.email;
    organization.callbackUrl = callbackUrl ?? organization.callbackUrl;
    
    if (address) {
        organization.address = { ...organization.address, ...address };
    }

    const updatedOrganization = await organization.save();

    const webhookPayload = updatedOrganization.toObject();
    await triggerWebhook('organization.updated', webhookPayload, updatedOrganization._id);

    const message = `The organization details for "${updatedOrganization.name}" were updated by ${req.user.firstName}.`;
    const adminsAndOwners = organization.members.filter(m => ['owner', 'admin'].includes(m.role));
    for (const admin of adminsAndOwners) {
        if (admin.userId.toString() !== req.user._id.toString()) {
            await createNotification(admin.userId, organization._id, 'organization_update', message, '/settings/organization');
        }
    }
    
    res.status(200).json(updatedOrganization);
});

// @desc    Generate new API Keys for an organization
// @route   POST /api/v1/organizations/:id/api-keys
// @access  Private/Owner or Admin
const generateApiKeys = asyncHandler(async (req, res) => {
    const { password } = req.body;
    if (!password) {
        res.status(400);
        throw new Error('Password is required to generate new keys.');
    }

    const organization = await Organization.findById(req.params.id);
    const user = await User.findById(req.user._id);

   // --- (Security checks are unchanged) ---
        if (!organization || !user) {
        res.status(404);
        throw new Error('Resource not found');
    }
    const member = organization.members.find(m => m.userId.equals(req.user._id));
    if (!member || !['owner', 'admin'].includes(member.role)) 
        {
        res.status(403);
        throw new Error('User does not have permission to generate keys.');
    }
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        res.status(401);
        throw new Error('Incorrect password.');
    }

    // --- KEY GENERATION (Unchanged) ---
    const publicKey = `pk_live_${crypto.randomBytes(16).toString('hex')}`;
    const secretKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    
    const salt = await bcrypt.genSalt(10);
    const secretKeyHash = await bcrypt.hash(secretKey, salt);

    organization.apiKeys = [{
        name: "Live Keys", 
        publicKey: publicKey,
        secretKeyHash: secretKeyHash,
        createdBy: req.user._id,
        lastUsed: new Date()
    }];
    organization.markModified('apiKeys');

    await organization.save();

    // Added: Trigger webhook for this security-sensitive event
    await triggerWebhook('organization.api_keys_regenerated', { organizationId: organization._id, generatedBy: req.user._id }, organization._id);

    // Added: Notify all admins and owners that new keys were generated
    const message = `New API keys were generated for "${organization.name}" by ${req.user.firstName}. Previous keys are now invalid.`;
    const link = '/settings/developer';
    const adminsAndOwners = organization.members.filter(m => ['owner', 'admin'].includes(m.role));
    for (const admin of adminsAndOwners) {
        await createNotification(admin.userId, organization._id, 'api_keys_generated', message, link);
    }
    

    res.status(200).json({
        message: "New keys generated successfully. Please save your secret key securely.",
        publicKey,
        secretKey 
    });
});


module.exports = { 
    getOrganizationById, 
    updateOrganization, 
    generateApiKeys
};


