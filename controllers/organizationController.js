const asyncHandler = require('express-async-handler');
const Organization = require('../models/Organization');

// @desc    Get organization details
// @route   GET /api/v1/organizations/:id
// @access  Private
const getOrganizationById = asyncHandler(async (req, res) => {
    // Populate member details for potential display of the team
    const organization = await Organization.findById(req.params.id).populate('members.userId', 'firstName lastName email');

    if (!organization) {
        res.status(404);
        throw new Error('Organization not found');
    }
    
    // Check if the current user is a member of the organization
    const isMember = organization.members.some(member => member.userId._id.equals(req.user._id));

    if (!isMember) {
        res.status(403);
        throw new Error('User is not authorized to view this organization');
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

    const member = organization.members.find(member => member.userId.equals(req.user._id));
    if (!member || !['owner', 'admin'].includes(member.role)) {
        res.status(403);
        throw new Error('User does not have permission to update this organization');
    }

    // Pull the data from the request body
    const { name, description, industry, website, phoneNumber, email, address } = req.body;

    // Update the fields if they were provided in the request
    organization.name = name || organization.name;
    organization.description = description || organization.description;
    organization.industry = industry || organization.industry;
    organization.website = website || organization.website;
    organization.phoneNumber = phoneNumber || organization.phoneNumber;
    organization.email = email || organization.email;
    
    if (address) {
        // This merges the new address data with any existing address data
        organization.address = { ...organization.address, ...address };
    }

    const updatedOrganization = await organization.save();
    
    res.status(200).json(updatedOrganization);
});


module.exports = { getOrganizationById, updateOrganization };