const asyncHandler = require('express-async-handler');
const Form = require('../models/Form');
const Organization = require('../models/Organization');


// @desc    Create a new form
// @route   POST /api/v1/forms
// @access  Private
const createForm = asyncHandler(async (req, res) => {
    const { name, description, template, fields, settings, layout } = req.body;
    const organizationId = req.user.currentOrganization;

    if (!organizationId) {
        res.status(400);
        throw new Error('User does not have a current organization selected');
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
        res.status(404);
        throw new Error('Organization not found');
    }

    const form = new Form({
        name,
        description,
        organization: organizationId,
        template,
        fields,
        settings,
        layout,
        createdBy: req.user._id,
        status: 'draft',
    });

    const createdForm = await form.save();

    // Add the new ID to locals for the audit middleware
    res.locals.resourceId = createdForm._id;

    res.status(201).json(createdForm);
});

// @desc    Get all forms for an organization
// @route   GET /api/v1/forms
// @access  Private
const getForms = asyncHandler(async (req, res) => {
    const organizationId = req.user.currentOrganization;
    const forms = await Form.find({ organization: organizationId }).populate('createdBy', 'firstName lastName');
    res.json(forms);
});

// @desc    Get a single form by ID
// @route   GET /api/v1/forms/:id
// @access  Private
const getFormById = asyncHandler(async (req, res) => {
    const form = await Form.findById(req.params.id);

    if (form && form.organization.toString() === req.user.currentOrganization.toString()) {
        res.json(form);
    } else {
        res.status(404);
        throw new Error('Form not found or not part of the current organization');
    }
});

// @desc    Update a form
// @route   PUT /api/v1/forms/:id
// @access  Private
const updateForm = asyncHandler(async (req, res) => {
    const form = await Form.findById(req.params.id);

    if (form && form.organization.toString() === req.user.currentOrganization.toString()) {
        form.name = req.body.name || form.name;
        form.description = req.body.description || form.description;
        form.fields = req.body.fields || form.fields;
        form.status = req.body.status || form.status;
        form.settings = req.body.settings || form.settings;
        form.layout = req.body.layout || form.layout;

        const updatedForm = await form.save();
        res.json(updatedForm);
    } else {
        res.status(404);
        throw new Error('Form not found or not part of the current organization');
    }
});

// @desc    Delete a form
// @route   DELETE /api/v1/forms/:id
// @access  Private
const deleteForm = asyncHandler(async (req, res) => {
    const form = await Form.findById(req.params.id);

    if (form && form.organization.toString() === req.user.currentOrganization.toString()) {
        await form.remove();
        res.json({ message: 'Form removed' });
    } else {
        res.status(404);
        throw new Error('Form not found or not part of the current organization');
    }
});

// @desc    Send a form to recipients
// @route   POST /api/v1/forms/:id/send
// @access  Private
const sendForm = asyncHandler(async (req, res) => {
    const { recipients, message, expiresIn } = req.body;
    const form = await Form.findById(req.params.id);

    if (form && form.organization.toString() === req.user.currentOrganization.toString()) {
        // In a real app, this would trigger emails to be sent.
        // For now, we just update the form with recipient info.
        const sentTo = [];
        recipients.forEach(recipient => {
            const uniqueAccessCode = require('crypto').randomBytes(16).toString('hex');
            form.recipients.push({ ...recipient, uniqueAccessCode, status: 'pending' });
            sentTo.push({ ...recipient, accessCode: uniqueAccessCode, status: 'pending' });
        });
        
        if (expiresIn) {
            let expires = new Date();
            expires.setDate(expires.getDate() + expiresIn);
            form.settings.expiresAt = expires;
        }

        form.status = 'active';
        await form.save();

        res.json({ success: true, sentTo });

    } else {
        res.status(404);
        throw new Error('Form not found or not part of the current organization');
    }
});

module.exports = { createForm, getForms, getFormById, updateForm, deleteForm, sendForm };