const asyncHandler = require('express-async-handler');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { deleteFromCloudinary } = require('../utils/cloudinary');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const createNotification = require('../utils/createNotification');
const triggerWebhook = require('../utils/triggerWebhook');
const sendEmail = require('../utils/email/sendEmail');
const { sendTokenResponse } = require('../utils/tokenUtils');

const setupGoogleUser = asyncHandler(async (req, res) => {
    const { name, industry } = req.body.organization;
    const userId = req.user._id;

    if (!name || !industry) {
        res.status(400);
        throw new Error('Please provide all required organization fields.');
    }

    const user = await User.findById(userId);

    if (user.currentOrganization) {
        res.status(400);
        throw new Error('This account has already completed the organization setup.');
    }

    const baseSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
    let slug = baseSlug;
    let counter = 1;
    while (await Organization.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    const newOrganization = await Organization.create({
        name,
        industry,
        slug,
        members: [{ userId: user._id, role: 'owner' }]
    });

    user.organizations.push(newOrganization._id);
    user.currentOrganization = newOrganization._id;
    user.lastLogin = new Date();
    await user.save();

    await sendTokenResponse(user, 201, res);
});

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

    if (req.body.name) organization.name = req.body.name;
    if (req.body.description) organization.description = req.body.description;
    if (req.body.industry) organization.industry = req.body.industry;
    if (req.body.website) organization.website = req.body.website;
    if (req.body.phoneNumber) organization.phoneNumber = req.body.phoneNumber;
    if (req.body.email) organization.email = req.body.email;
    if (req.body.callbackUrl !== undefined) {
        organization.callbackUrl = req.body.callbackUrl;
    }
    if (req.body.address) {
        organization.address = { ...organization.address, ...req.body.address };
    }

    const updatedOrganization = await organization.save();
    await triggerWebhook('organization.updated', updatedOrganization.toObject(), updatedOrganization._id);
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

// @desc      Invite a new member to an organization
// @route     POST /api/v1/organizations/:id/members
// @access    Private/Owner or Admin
const inviteMember = asyncHandler(async (req, res) => {
    const { email, role } = req.body;
    const organizationId = req.params.id;

    if (!email || !role) {
        res.status(400);
        throw new Error('Please provide an email and a role for the new member.');
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
        res.status(404);
        throw new Error('Organization not found.');
    }

    // 1. PERMISSION CHECK: Only Owner or Admin can invite
    const inviterMembership = organization.members.find(m => m.userId.equals(req.user._id));
    if (!inviterMembership || !['owner', 'admin'].includes(inviterMembership.role)) {
        res.status(403);
        throw new Error('You do not have permission to invite members to this organization.');
    }

    // 2. Find the user to be invited
    const userToInvite = await User.findOne({ email });
    if (!userToInvite) {
        res.status(404);
        throw new Error(`User with email ${email} not found. Please ask them to sign up first.`);
    }

    // 3. Check if the user is already a member
    const isAlreadyMember = organization.members.some(m => m.userId.equals(userToInvite._id));
    if (isAlreadyMember) {
        res.status(400);
        throw new Error('This user is already a member of the organization.');
    }

    // 4. Add the new member to the organization & user record
    organization.members.push({ userId: userToInvite._id, role });
    userToInvite.organizations.push(organization._id);
    await organization.save();
    await userToInvite.save();

    // 5. Create in-app notification
    const message = `You've been added to the "${organization.name}" organization as a(n) ${role}.`;
    await createNotification(userToInvite._id, organization._id, 'new_member', message, '/dashboard');

    try {
        await sendEmail({
            send_to: userToInvite.email,
            subject: `You've been invited to join ${organization.name} on PraxForm`,
            sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
            reply_to: process.env.PRAXFORM_EMAIL_USER,
            template: "member-invite",
            name: userToInvite.firstName,
            organizationName: organization.name,
            inviterName: `${req.user.firstName} ${req.user.lastName}`,
            link: `${process.env.PRAXFORM_FRONTEND_HOST}/dashboard`
        });
    } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
        // Do not fail the request if the email fails, just log it
    }

    res.status(200).json({
        success: true,
        message: `${userToInvite.firstName} has been added and notified.`
    });
});

// @desc      Remove a member from an organization
// @route     DELETE /api/v1/organizations/:id/members/:memberId
// @access    Private/Owner Only
const removeMember = asyncHandler(async (req, res) => {
    const { id: organizationId, memberId } = req.params;

    const organization = await Organization.findById(organizationId);
    if (!organization) {
        res.status(404);
        throw new Error('Organization not found.');
    }

    // 1. PERMISSION CHECK: Must be an owner
    const removerMembership = organization.members.find(m => m.userId.equals(req.user._id));
    if (!removerMembership || removerMembership.role !== 'owner') {
        res.status(403);
        throw new Error('You do not have permission to remove members.');
    }
    
    // Find the user being removed *before* changing data
    const removedUser = await User.findById(memberId);
    if (!removedUser) {
        res.status(404);
        throw new Error('Member to be removed not found.');
    }

    // 2. Logic to prevent removing the last owner
    const memberToRemove = organization.members.find(m => m.userId.equals(memberId));
    if (memberToRemove && memberToRemove.role === 'owner') {
        const ownerCount = organization.members.filter(m => m.role === 'owner').length;
        if (ownerCount <= 1) {
            res.status(400);
            throw new Error('Cannot remove the only owner of the organization.');
        }
    }
    
    // 3. Remove the member from the organization & user record
    organization.members.pull({ userId: memberId });
    removedUser.organizations.pull(organizationId);
    if (removedUser.currentOrganization && removedUser.currentOrganization.equals(organizationId)) {
        removedUser.currentOrganization = removedUser.organizations[0] || null;
    }
    await organization.save();
    await removedUser.save();
    
    // 4. ✅ ADDED: Send removal email
    try {
        await sendEmail({
            send_to: removedUser.email,
            subject: `You have been removed from ${organization.name}`,
            sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
            reply_to: process.env.PRAXFORM_EMAIL_USER,
            template: "member-removed",
            name: removedUser.firstName,
            organizationName: organization.name
        });
    } catch (emailError) {
        console.error('Error sending removal email:', emailError);
    }
    
    res.status(200).json({
        success: true,
        message: 'Member removed successfully.'
    });
});

// @desc      Update organization logo
// @route     PUT /api/v1/organizations/:id/logo
// @access    Private/Admin or Owner
const updateOrganizationLogo = asyncHandler(async (req, res) => {
    const { public_id, url } = req.body;
    const organizationId = req.params.id;

    if (!public_id || !url) {
        res.status(400);
        throw new Error('Please provide public_id and url');
    }

    const organization = await Organization.findById(organizationId);

    if (!organization) {
        res.status(404);
        throw new Error('Organization not found');
    }

    // Permission check
    const member = organization.members.find(m => m.userId.equals(req.user._id));
    if (!member || !['owner', 'admin'].includes(member.role)) {
        res.status(403);
        throw new Error('User does not have permission to update this organization');
    }

    // Check if there is an old logo and delete it from Cloudinary
    if (organization.logo && organization.logo.public_id) {
        await deleteFromCloudinary(organization.logo.public_id);
    }

    // Update with the new logo info
    organization.logo = { public_id, url };
    await organization.save();

    res.status(200).json({
        message: 'Organization logo updated successfully',
        logo: organization.logo,
    });
});

module.exports = {
    setupGoogleUser,
    getOrganizationById,
    updateOrganization,
    generateApiKeys,
    inviteMember,
    removeMember,
    updateOrganizationLogo
};