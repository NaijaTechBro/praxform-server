const asyncHandler = require('express-async-handler');
const Submission = require('../models/Submission');
const Form = require('../models/Form');

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
    
    // Logic to validate accessCode if required by the form
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
        status: 'complete'
    });

    const createdSubmission = await submission.save();

    // Update form's submission count and recipient status
    form.submissionCount += 1;
    recipient.status = 'completed';
    await form.save();
    
    res.status(201).json(createdSubmission);
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
        // Here you would add logic to decrypt 'encryptedData' before sending
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


module.exports = { createSubmission, getSubmissionsByForm, getSubmissionById, deleteSubmission };