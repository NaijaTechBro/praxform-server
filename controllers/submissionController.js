// const asyncHandler = require('express-async-handler');
// const Submission = require('../models/Submission');
// const Form = require('../models/Form');
// const createNotification = require('../utils/createNotification');
// const triggerWebhook = require('../utils/triggerWebhook');

// // @desc      Create a new submission (public)
// // @route     POST /api/v1/submissions
// // @access    Public
// const createSubmission = asyncHandler(async (req, res) => {
//     const { formId, accessCode, data, encryptedData, files } = req.body;

//     const form = await Form.findById(formId).populate('organization').populate('createdBy', 'firstName lastName');

//     if (!form) {
//         res.status(404);
//         throw new Error('Form not found');
//     }

//     // --- validation logic ---
//     const recipient = form.recipients.find(r => r.uniqueAccessCode === accessCode);
//     const isPublicLink = form.publicLink?.enabled && form.publicLink?.uniqueAccessCode === accessCode;

//     if (!recipient && !isPublicLink) {
//         res.status(403);
//         throw new Error('Invalid access code for submission.');
//     }
    
//     if (recipient && form.settings.oneTimeUse && recipient.status === 'completed') {
//         res.status(403);
//         throw new Error('This form has already been submitted and cannot be submitted again.');
//     }
    
//     if (form.settings.dueDate && new Date() > new Date(form.settings.dueDate)) {
//         res.status(403);
//         throw new Error('This form is past its due date and is no longer accepting submissions.');
//     }


//     // --- Plan limit enforcement ---
//     const organization = form.organization;
//     const maxSubmissions = organization.planLimits.maxSubmissionsPerMonth;

//     if (maxSubmissions !== -1) {
//         const now = new Date();
//         const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

//         const monthlyCount = await Submission.countDocuments({
//             organization: organization._id,
//             createdAt: { $gte: startOfMonth }
//         });

//         if (monthlyCount >= maxSubmissions) {
//             console.error(`Submission blocked for org ${organization._id}: Monthly limit of ${maxSubmissions} reached.`);
//             res.status(429);
//             throw new Error('This form is currently not accepting new submissions.');
//         }
//     }
    
    
//     const submission = new Submission({
//         form: formId,
//         organization: form.organization._id,
//         data,
//         encryptedData,
//         files,
//         status: 'complete',
//         recipientEmail: recipient ? recipient.email : null
//     });

//     const createdSubmission = await submission.save();

//     // ---- NOTIFICATION & WEBHOOK LOGIC ----
//     if (form.createdBy) {
//         const message = `You have a new submission for the form: "${form.name}".`;
//         const link = `/forms/${form._id}/submissions/${createdSubmission._id}`;
//         await createNotification(form.createdBy._id, form.organization._id, 'form_submission', message, link);
//     }
    
//     form.submissionCount += 1;
//     if (recipient) {
//         recipient.status = 'completed';
//     }
//     await form.save();

//     const webhookPayload = {
//         event: 'submission.created',
//         formId: form._id,
//         submissionId: createdSubmission._id,
//         timestamp: new Date().toISOString(),
//         data: createdSubmission
//     };

//     await triggerWebhook('submission.created', webhookPayload, form.organization._id);

//     res.status(201).json(createdSubmission);
// });


// // @desc    Get a form by ID and access code (public)
// // @route   GET /api/v1/submissions/:id/:accessCode
// // @access  Public
// const getPublicFormByAccessCode = asyncHandler(async (req, res) => {
//     const { id, accessCode } = req.params;
//     const form = await Form.findById(id);

//     if (!form) {
//         res.status(404);
//         throw new Error('Form not found');
//     }
    
//     if (form.settings.dueDate && new Date() > new Date(form.settings.dueDate)) {
//         res.status(403);
//         throw new Error('This form is past its due date and is no longer accepting submissions.');
//     }
//     if (form.status !== 'active') {
//         res.status(403);
//         throw new Error('This form is not currently active.');
//     }
   
//     const recipient = form.recipients.find(
//         (r) => r.uniqueAccessCode === accessCode
//     );

//    const isPublicLink = form.publicLink?.enabled && form.publicLink?.uniqueAccessCode === accessCode;

//     if (!recipient && !isPublicLink) {
//         res.status(403);
//         throw new Error('Invalid or expired access code');
//     }

//     if (recipient && form.settings.oneTimeUse && recipient.status === 'completed') {
//         res.status(403);
//         throw new Error('This link has already been used and is no longer valid.');
//     }

//     const publicForm = {
//         _id: form._id,
//         name: form.name,
//         description: form.description,
//         fields: form.fields,
//         organization: form.organization,
//         status: form.status,
//         encryptionKey: form.encryptionKey,
//     };

//     res.json(publicForm);
// });

// // @desc    Get submissions for a form
// // @route   GET /api/v1/forms/:id/submissions
// // @access  Private
// const getSubmissionsByForm = asyncHandler(async (req, res) => {
//     const form = await Form.findById(req.params.id);

//     if (form && form.organization.toString() === req.user.currentOrganization.toString()) {
//         const submissions = await Submission.find({ form: req.params.id });
//         res.json(submissions);
//     } else {
//         res.status(404);
//         throw new Error('Form not found or not part of the current organization');
//     }
// });

// // @desc    Get a single submission by ID
// // @route   GET /api/v1/submissions/:id
// // @access  Private
// const getSubmissionById = asyncHandler(async (req, res) => {
//     const submission = await Submission.findById(req.params.id);

//     if (submission && submission.organization.toString() === req.user.currentOrganization.toString()) {
//         res.json(submission);
//     } else {
//         res.status(404);
//         throw new Error('Submission not found or not part of the current organization');
//     }
// });

// // @desc    Delete a submission
// // @route   DELETE /api/v1/submissions/:id
// // @access  Private
// const deleteSubmission = asyncHandler(async (req, res) => {
//     const submission = await Submission.findById(req.params.id);

//     if (submission && submission.organization.toString() === req.user.currentOrganization.toString()) {
//         await submission.remove();
//         res.json({ message: 'Submission removed' });
//     } else {
//         res.status(404);
//         throw new Error('Submission not found or not part of the current organization');
//     }
// });

// module.exports = { 
//     createSubmission, 
//     getPublicFormByAccessCode,
//     getSubmissionsByForm, 
//     getSubmissionById, 
//     deleteSubmission 
// };


const asyncHandler = require('express-async-handler');
const Submission = require('../models/Submission');
const Form = require('../models/Form');
const createNotification = require('../utils/createNotification');
const triggerWebhook = require('../utils/triggerWebhook');

// @desc      Create a new submission (public)
// @route     POST /api/v1/submissions
// @access    Public
const createSubmission = asyncHandler(async (req, res) => {
    const { formId, accessCode, data, encryptedData, files } = req.body;

    const form = await Form.findById(formId).populate('organization').populate('createdBy', 'firstName lastName');

    if (!form) {
        res.status(404);
        throw new Error('Form not found');
    }

    // --- Validation Logic ---
    const recipient = form.recipients.find(r => r.uniqueAccessCode === accessCode);
    const isPublicLink = form.publicLink?.enabled && form.publicLink?.uniqueAccessCode === accessCode;

    if (!recipient && !isPublicLink) {
        res.status(403);
        throw new Error('Invalid access code for submission.');
    }
    
    if (recipient && form.settings.oneTimeUse && recipient.status === 'completed') {
        res.status(403);
        throw new Error('This form has already been submitted and cannot be submitted again.');
    }
    
    // Check due date before accepting submission
    if (form.settings.dueDate && new Date() > new Date(form.settings.dueDate)) {
        res.status(403);
        throw new Error('This form is past its due date and is no longer accepting submissions.');
    }

    // --- Plan limit enforcement ---
    const organization = form.organization;
    const maxSubmissions = organization.planLimits.maxSubmissionsPerMonth;

    if (maxSubmissions !== -1) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyCount = await Submission.countDocuments({
            organization: organization._id,
            createdAt: { $gte: startOfMonth }
        });
        if (monthlyCount >= maxSubmissions) {
            res.status(429);
            throw new Error('This form is currently not accepting new submissions.');
        }
    }
    
    const submission = new Submission({
        form: formId,
        organization: form.organization._id,
        data,
        encryptedData,
        files,
        status: 'complete',
        recipientEmail: recipient ? recipient.email : null
    });

    const createdSubmission = await submission.save();

    if (form.createdBy) {
        const message = `You have a new submission for the form: "${form.name}".`;
        const link = `/forms/${form._id}/submissions/${createdSubmission._id}`;
        await createNotification(form.createdBy._id, form.organization._id, 'form_submission', message, link);
    }
    
    form.submissionCount += 1;
    if (recipient) {
        recipient.status = 'completed';
    }
    await form.save();

    const webhookPayload = createdSubmission.toObject();
    await triggerWebhook('submission.created', webhookPayload, form.organization._id);

    res.status(201).json(createdSubmission);
});

// @desc      Get a form by ID and access code (public)
// @route     GET /api/v1/submissions/:id/:accessCode
// @access    Public
const getPublicFormByAccessCode = asyncHandler(async (req, res) => {
    const { id, accessCode } = req.params;
    const form = await Form.findById(id);

    if (!form) {
        res.status(404);
        throw new Error('Form not found');
    }
    
    // --- START OF FIX: Add rule checks before showing the form ---
    if (form.settings.dueDate && new Date() > new Date(form.settings.dueDate)) {
        res.status(403);
        throw new Error('This form is past its due date and is no longer accepting submissions.');
    }
    // Only allow access if the form is 'active'
    if (form.status !== 'active') {
        res.status(403);
        throw new Error('This form is not currently active.');
    }
    // --- END OF FIX ---
   
    const recipient = form.recipients.find((r) => r.uniqueAccessCode === accessCode);
    const isPublicLink = form.publicLink?.enabled && form.publicLink?.uniqueAccessCode === accessCode;

    if (!recipient && !isPublicLink) {
        res.status(403);
        throw new Error('Invalid or expired access code');
    }

    if (recipient && form.settings.oneTimeUse && recipient.status === 'completed') {
        res.status(403);
        throw new Error('This link has already been used and is no longer valid.');
    }

    const publicForm = {
        _id: form._id,
        name: form.name,
        description: form.description,
        fields: form.fields,
        organization: form.organization, // This might be null if not populated, which is fine for the public view
        status: form.status,
        encryptionKey: form.encryptionKey,
    };

    res.json(publicForm);
});

// @desc      Get submissions for a form
// @route     GET /api/v1/forms/:id/submissions
// @access    Private
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

// @desc      Get a single submission by ID
// @route     GET /api/v1/submissions/:id
// @access    Private
const getSubmissionById = asyncHandler(async (req, res) => {
    const submission = await Submission.findById(req.params.id);
    if (submission && submission.organization.toString() === req.user.currentOrganization.toString()) {
        res.json(submission);
    } else {
        res.status(404);
        throw new Error('Submission not found or not part of the current organization');
    }
});

// @desc      Delete a submission
// @route     DELETE /api/v1/submissions/:id
// @access    Private
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