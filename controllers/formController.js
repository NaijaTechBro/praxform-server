const asyncHandler = require('express-async-handler');
const Form = require('../models/Form');
const Organization = require('../models/Organization');
const crypto = require('crypto');
const sendEmail = require('../utils/email/sendEmail');

// @desc    Create a new form
// @route   POST /api/v1/forms
// @access  Private
const createForm = asyncHandler(async (req, res) => {
    const { name, description, template, fields, settings, layout } = req.body;
    const organizationId = req.user.currentOrganization;

    if (!organizationId) {
        res.status(400);
        throw new Error('User does not have a current organization selected');
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
        encryptionKey: crypto.randomBytes(32).toString('hex'),
    });

    const createdForm = await form.save();
    res.status(201).json(createdForm);
});

// @desc    Get all forms for an organization
// @route   GET /api/v1/forms
// @access  Private
const getForms = asyncHandler(async (req, res) => {
    const organizationId = req.user.currentOrganization;
    const forms = await Form.find({ organization: organizationId }).populate('createdBy', 'firstName lastName');
    res.json(forms);
});

// @desc    Get a single form by ID
// @route   GET /api/v1/forms/:id
// @access  Private
const getFormById = asyncHandler(async (req, res) => {
    const form = await Form.findById(req.params.id);

    if (form && form.organization.toString() === req.user.currentOrganization.toString()) {
        // Check if the form has an encryption key
        if (!form.encryptionKey) {
            // If not, generate a new one, save it, and then return the updated form
            form.encryptionKey = crypto.randomBytes(32).toString('hex');
            await form.save();
        }
        res.json(form);
    } else {
        res.status(404);
        throw new Error('Form not found or not part of the current organization');
    }
});

// @desc    Update a form
// @route   PUT /api/v1/forms/:id
// @access  Private
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

// @desc    Delete a form
// @route   DELETE /api/v1/forms/:id
// @access  Private
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

// @desc    Send a form to recipients
// @route   POST /api/v1/forms/:id/send
// @access  Private
const sendForm = asyncHandler(async (req, res) => {
    const { recipients, message } = req.body;
    const form = await Form.findById(req.params.id);

    if (form && form.organization.toString() === req.user.currentOrganization.toString()) {
        const sentTo = [];
        
        // Use the authenticated user's details for the sender information
        const senderName = req.user.firstName + ' ' + req.user.lastName;
        const senderEmail = req.user.email;

        const sendPromises = recipients.map(async (recipient) => {
            const uniqueAccessCode = crypto.randomBytes(16).toString('hex');
            
            form.recipients.push({
                email: recipient.email,
                name: recipient.name,
                uniqueAccessCode,
                status: 'pending'
            });

            // Construct the unique link for the recipient
            const formUrl = `${req.protocol}://${process.env.PRAXFORM_FRONTEND_HOST}/form/${form._id}/${uniqueAccessCode}`;
            
            try {
                await sendEmail({
                    send_to: recipient.email,
                    subject: `You have a new form to fill out from ${senderName}: ${form.name}`,
                    sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
                    reply_to: process.env.PRAXFORM_EMAIL_USER,
                    template: 'form-invitation',
                    name: recipient.name,
                    link: formUrl,
                    message, 
                    date: new Date().toLocaleDateString()
                });
                sentTo.push({ email: recipient.email, status: 'sent' });
            } catch (error) {
                console.error(`Failed to send email to ${recipient.email}:`, error);
                sentTo.push({ email: recipient.email, status: 'failed' });
            }
        });

        await Promise.all(sendPromises);

        form.status = 'active';
        await form.save();

        res.json({ success: true, sentTo });

    } else {
        res.status(404);
        throw new Error('Form not found or not part of the current organization');
    }
});

module.exports = { createForm, getForms, getFormById, updateForm, deleteForm, sendForm };



