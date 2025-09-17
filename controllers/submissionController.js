const asyncHandler = require('express-async-handler');
const Submission = require('../models/Submission');
const Form = require('../models/Form');
const createNotification = require('../utils/createNotification');
const triggerWebhook = require('../utils/triggerWebhook');

// @desc    Create a new submission (public)
// @route   POST /api/v1/submissions
// @access  Public
const createSubmission = asyncHandler(async (req, res) => {
    const { formId, accessCode, data, encryptedData, files } = req.body;

    const form = await Form.findById(formId).populate('organization');

    if (!form) {
        res.status(404);
        throw new Error('Form not found');
    }

       // Added: Plan limit enforcement
    const organization = form.organization;
    const maxSubmissions = organization.planLimits.maxSubmissionsPerMonth;

    // Check only if the plan has a limit (unlimited is -1)
    if (maxSubmissions !== -1) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyCount = await Submission.countDocuments({
            organization: organization._id,
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        });

        if (monthlyCount >= maxSubmissions) {
          console.error(`Submission blocked for org ${organization._id}: Monthly limit of ${maxSubmissions} reached.`);
            res.status(429);
            throw new Error('This form is currently not accepting new submissions.');
        }
    }
    // End: Plan limit enforcement

    if (!form) {
        res.status(404);
        throw new Error('Form not found');
    }

    const recipient = form.recipients.find(r => r.uniqueAccessCode === accessCode);
    if (!recipient && (!form.publicLink || !form.publicLink.enabled || form.publicLink.uniqueAccessCode !== accessCode)) {
        res.status(403);
        throw new Error('Invalid or expired access code');
    }

    const submission = new Submission({
        form: formId,
        organization: form.organization,
        data,
        encryptedData,
        files,
        status: 'complete',
        recipientEmail: recipient.email
    });

    const createdSubmission = await submission.save();

    // ---- NOTIFICATION LOGIC ----
        if (form.createdBy) {
        const message = `You have a new submission for the form: "${form.name}".`;
        const link = `/forms/${form._id}/submissions/${createdSubmission._id}`;
        await createNotification(form.createdBy, form.organization, 'form_submission', message, link);
    }
    
    form.submissionCount += 1;
    recipient.status = 'completed';
    await form.save();


    const webhookPayload = {
        event: 'submission.created',
        formId: form._id,
        submissionId: createdSubmission._id,
        timestamp: new Date().toISOString(),
        data: createdSubmission
    };

    // Added: Call the centralized triggerWebhook utility.
    await triggerWebhook('submission.created', webhookPayload, form.organization);

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
    
    const publicForm = {
        _id: form._id,
        name: form.name,
        description: form.description,
        fields: form.fields,
        organization: form.organization,
        status: form.status,
        encryptionKey: form.encryptionKey,
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