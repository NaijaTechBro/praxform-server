const asyncHandler = require('express-async-handler');
const Submission = require('../models/Submission');
const Form = require('../models/Form');
const Webhook = require('../models/Webhook');
const axios = require('axios');
const crypto = require('crypto');

// @desc    Create a new submission (public)
// @route   POST /api/v1/submissions
// @access  Public
const createSubmission = asyncHandler(async (req, res) => {
    const { formId, accessCode, data, encryptedData, files } = req.body;

    const form = await Form.findById(formId);

    if (!form) {
        res.status(404);
        throw new Error('Form not found');
    }

    const recipient = form.recipients.find(r => r.uniqueAccessCode === accessCode);
    if (!recipient) {
        res.status(403);
        throw new Error('Invalid access code');
    }

    const submission = new Submission({
        form: formId,
        organization: form.organization,
        data,
        encryptedData,
        files,
        status: 'complete',
        recipientEmail: recipient.email // Added this line to store the email
    });

    const createdSubmission = await submission.save();

    form.submissionCount += 1;
    recipient.status = 'completed';
    await form.save();

    // ---- WEBHOOK TRIGGER LOGIC ----
    const webhooks = await Webhook.find({
        organization: form.organization,
        status: 'active',
        events: 'submission.created'
    });

    const payload = {
        event: 'submission.created',
        formId: form._id,
        submissionId: createdSubmission._id,
        timestamp: new Date().toISOString(),
        data: createdSubmission
    };

    for (const webhook of webhooks) {
        try {
            const hmac = crypto.createHmac('sha256', webhook.secret);
            hmac.update(JSON.stringify(payload));
            const signature = hmac.digest('hex');

            await axios.post(webhook.endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': signature,
                }
            });
            console.log(`Webhook sent to ${webhook.endpoint}`);
        } catch (error) {
            console.error(`Failed to send webhook to ${webhook.endpoint}: ${error.message}`);
        }
    }

    res.status(201).json(createdSubmission);
});

// @desc    Get a form by ID and access code (public)
// @route   GET /api/v1/submissions/:id/:accessCode
// @access  Public
const getPublicFormByAccessCode = asyncHandler(async (req, res) => {
    const { id, accessCode } = req.params;

    const form = await Form.findById(id);

    if (!form) {
        res.status(404);
        throw new Error('Form not found');
    }

    const recipient = form.recipients.find(
        (r) => r.uniqueAccessCode === accessCode && r.status === 'pending'
    );

    if (!recipient) {
        res.status(403);
        throw new Error('Invalid or expired access code');
    }
    
    // Return only the necessary form details for public viewing
    const publicForm = {
        _id: form._id,
        name: form.name,
        description: form.description,
        fields: form.fields,
        organization: form.organization,
        status: form.status
    };

    res.json(publicForm);
});

// @desc    Get submissions for a form
// @route   GET /api/v1/forms/:id/submissions
// @access  Private
const getSubmissionsByForm = asyncHandler(async (req, res) => {
    const form = await Form.findById(req.params.id);

    if (form && form.organization.toString() === req.user.currentOrganization.toString()) {
        const submissions = await Submission.find({ form: req.params.id });
        res.json(submissions);
    } else {
        res.status(404);
        throw new Error('Form not found or not part of the current organization');
    }
});

// @desc    Get a single submission by ID
// @route   GET /api/v1/submissions/:id
// @access  Private
const getSubmissionById = asyncHandler(async (req, res) => {
    const submission = await Submission.findById(req.params.id);

    if (submission && submission.organization.toString() === req.user.currentOrganization.toString()) {
        res.json(submission);
    } else {
        res.status(404);
        throw new Error('Submission not found or not part of the current organization');
    }
});

// @desc    Delete a submission
// @route   DELETE /api/v1/submissions/:id
// @access  Private
const deleteSubmission = asyncHandler(async (req, res) => {
    const submission = await Submission.findById(req.params.id);

    if (submission && submission.organization.toString() === req.user.currentOrganization.toString()) {
        await submission.remove();
        res.json({ message: 'Submission removed' });
    } else {
        res.status(404);
        throw new Error('Submission not found or not part of the current organization');
    }
});

module.exports = { 
    createSubmission, 
    getPublicFormByAccessCode,
    getSubmissionsByForm, 
    getSubmissionById, 
    deleteSubmission 
};