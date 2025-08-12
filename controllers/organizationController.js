const asyncHandler = require('express-async-handler');
const Organization = require('../models/Organization');

// @desc    Get organization details
// @route   GET /api/v1/organizations/:id
// @access  Private
const getOrganizationById = asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.params.id).populate('members.userId', 'firstName lastName email');

    if (!organization) {
        res.status(404);
        throw new Error('Organization not found');
    }
    
    // Check if the current user is a member of the organization
    const isMember = organization.members.some(member => member.userId._id.equals(req.user._id));

    if (!isMember) {
        res.status(403);
        throw new Error('User is not a member of this organization');
    }

    res.json(organization);
});

// @desc    Update organization
// @route   PUT /api/v1/organizations/:id
// @access  Private/Owner or Admin
const updateOrganization = asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.params.id);

    if (!organization) {
        res.status(404);
        throw new Error('Organization not found');
    }

    // Check if user is an owner or admin of the organization
    const member = organization.members.find(member => member.userId.equals(req.user._id));
    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        res.status(403);
        throw new Error('User does not have permission to update this organization');
    }

    organization.name = req.body.name || organization.name;
    organization.description = req.body.description || organization.description;
    organization.industry = req.body.industry || organization.industry;
    organization.website = req.body.website || organization.website;
    organization.phone = req.body.phone || organization.phone;
    organization.email = req.body.email || organization.email;
    
    if (req.body.address) {
        organization.address = { ...organization.address, ...req.body.address };
    }

    const updatedOrganization = await organization.save();
    res.json(updatedOrganization);
});


module.exports = { getOrganizationById, updateOrganization };