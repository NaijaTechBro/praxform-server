const asyncHandler = require('express-async-handler');
const Form = require('../models/Form');
const Organization = require('../models/Organization');
const crypto = require('crypto');
const sendEmail = require('../utils/email/sendEmail');
const triggerWebhook = require('../utils/triggerWebhook');


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

    // Added: Plan limit enforcement
    const organization = await Organization.findById(organizationId);
    const formCount = await Form.countDocuments({ organization: organizationId });

    if (formCount >= organization.planLimits.maxForms) {
        res.status(403); // 403 Forbidden is more appropriate than 400
        throw new Error(`You have reached the limit of ${organization.planLimits.maxForms} forms for your plan. Please upgrade to create more.`);
    }
    // End: Plan limit enforcement

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

    triggerWebhook('form.created', createdForm, organizationId);
    
    res.status(201).json(createdForm);
});
 

// @desc    Send a form to recipients with options
// @route   POST /api/v1/forms/:id/send
// @access  Private
const sendForm = asyncHandler(async (req, res) => {
    const { recipients, message, oneTimeUse, smsCode, emailAuth, dueDate } = req.body;
    const form = await Form.findById(req.params.id);

    if (form && form.organization.toString() === req.user.currentOrganization.toString()) {
        const sentTo = [];
        
        const senderName = req.user.firstName + ' ' + req.user.lastName;
        const senderEmail = req.user.email;

        const sendPromises = recipients.map(async (recipient) => {
            const uniqueAccessCode = crypto.randomBytes(16).toString('hex');
            
            // Avoid adding duplicate recipients
            if (!form.recipients.some(r => r.email === recipient.email)) {
                form.recipients.push({
                    email: recipient.email,
                    name: recipient.name,
                    uniqueAccessCode,
                    status: 'pending'
                });
            }

            const formUrl = `${process.env.PRAXFORM_FRONTEND_HOST}/form/${form._id}/${uniqueAccessCode}`;
            
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

        // --- SAVE NEW SETTINGS ---
        form.settings.oneTimeUse = oneTimeUse || false;
        form.settings.requireSmsAuth = smsCode || false;
        form.settings.requireEmailAuth = emailAuth || false;
        form.settings.dueDate = dueDate || null;

        form.status = 'active';
        await form.save();

        res.json({ success: true, sentTo });

    } else {
        res.status(404);
        throw new Error('Form not found or not part of the current organization');
    }
});

// @desc    Generate a secure, public link for a form
// @route   POST /api/v1/forms/:id/secure-link
// @access  Private
const generateSecureLink = asyncHandler(async (req, res) => {
    const form = await Form.findById(req.params.id);

    if (form && form.organization.toString() === req.user.currentOrganization.toString()) {
        // Generate a new code if it doesn't exist or is disabled
        if (!form.publicLink || !form.publicLink.enabled) {
            form.publicLink = {
                enabled: true,
                uniqueAccessCode: crypto.randomBytes(16).toString('hex'),
            };
            await form.save();
        }
        
        const secureUrl = `${process.env.PRAXFORM_FRONTEND_HOST}/form/public/${form._id}/${form.publicLink.uniqueAccessCode}`;
        
        res.json({ success: true, link: secureUrl });

    } else {
        res.status(404);
        throw new Error('Form not found or not part of the current organization');
    }
});


/* --- OTHER CONTROLLERS (UNCHANGED) --- */
const getForms = asyncHandler(async (req, res) => {
    const organizationId = req.user.currentOrganization;
    const forms = await Form.find({ organization: organizationId }).populate('createdBy', 'firstName lastName');
    res.json(forms);
});

const getFormById = asyncHandler(async (req, res) => {
    const form = await Form.findById(req.params.id);
    if (form && form.organization.toString() === req.user.currentOrganization.toString()) {
        if (!form.encryptionKey) {
            form.encryptionKey = crypto.randomBytes(32).toString('hex');
            await form.save();
        }
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
    
    const form = await Form.findById(req.params.id)
        .populate('organization')
        .populate('createdBy', 'firstName lastName');

    if (form && form.organization._id.toString() === req.user.currentOrganization.toString()) {
        form.name = req.body.name || form.name;
        form.description = req.body.description || form.description;
        form.fields = req.body.fields || form.fields;
        form.status = req.body.status || form.status;
        form.settings = req.body.settings || form.settings;
        form.layout = req.body.layout || form.layout;

        const updatedForm = await form.save();

        // This function receives the populated organization object, which is fine.
        await triggerWebhook('form.updated', updatedForm, form.organization);

        const message = `The form "${updatedForm.name}" has been updated.`;
        const link = `/forms/${updatedForm._id}`;
        if (form.createdBy) {
            await createNotification(form.createdBy._id, form.organization._id, 'form_update', message, link);
        }

        res.json(updatedForm);
    } else {
        res.status(404);
        throw new Error('Form not found or not part of the current organization');
    }
});

// @desc    Delete a form
// @route   DELETE /api/v1/forms/:id
// @access  Private

const deleteForm = asyncHandler(async (req, res, next) => {
    const form = await Form.findById(req.params.id)
        .populate('organization') // Keep populating, it's good practice
        .populate('createdBy', 'firstName lastName');

    if (form && form.organization._id.toString() === req.user.currentOrganization.toString()) {
        res.locals.auditDetails = { 
            formId: form._id,
            formName: req.body.formName || form.name 
        };

        // This function is fine
        await triggerWebhook('form.deleted', { formId: form._id, formName: form.name }, form.organization);
        
        const message = `The form "${form.name}" has been deleted.`;
        
        if (form.createdBy) {
            await createNotification(form.createdBy._id, form.organization._id, 'form_deleted', message, null);
        }

        // This function is also fine
        await form.deleteOne();

        res.json({ message: 'Form removed' });
    } else {
        res.status(404);
        throw new Error('Form not found or not part of the current organization');
    }
});

module.exports = { createForm, getForms, getFormById, updateForm, deleteForm, sendForm, generateSecureLink };
