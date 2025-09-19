// const asyncHandler = require('express-async-handler');
// const crypto = require('crypto');
// const nodemailer = require('nodemailer');
// const Submission = require('../models/Submission');
// const Form = require('../models/Form');
// const createNotification = require('../utils/createNotification');
// const triggerWebhook = require('../utils/triggerWebhook');
// const sendEmail = require('../utils/email/sendEmail');

// // Helper to generate a 6-digit numeric code
// const generateSixDigitCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// // @desc      Get a form (or initiate verification if required)
// // @route     GET /api/v1/submissions/:id/:accessCode
// // @access    Public
// const getPublicFormByAccessCode = asyncHandler(async (req, res) => {
//     const { id, accessCode } = req.params;
//     const form = await Form.findById(id);

//     if (!form) { res.status(404); throw new Error('Form not found'); }
//     if (form.settings.dueDate && new Date() > new Date(form.settings.dueDate)) { res.status(403); throw new Error('This form is past its due date.'); }
//     if (form.status !== 'active') { res.status(403); throw new Error('This form is not currently active.'); }

//     const recipient = form.recipients.find((r) => r.uniqueAccessCode === accessCode);
//     const isPublicLink = form.publicLink?.enabled && form.publicLink?.uniqueAccessCode === accessCode;

//     if (!recipient && !isPublicLink) { res.status(403); throw new Error('Invalid or expired access code'); }
//     if (recipient && form.settings.oneTimeUse && recipient.status === 'completed') { res.status(403); throw new Error('This link has already been used.'); }

//     // --- SECURITY FLOW UPDATE ---
//     // If auth is required, we start the verification process here instead of sending the form.
//     if (form.settings.requireEmailAuth || form.settings.requireSmsAuth) {
//         if (!recipient) {
//             res.status(400);
//             throw new Error("This secure form requires a specific recipient and cannot be accessed via a public link.");
//         }

//         const verificationCode = generateSixDigitCode();
//         const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
//         recipient.verificationCode = hashedCode;
//         recipient.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
//         await form.save();

//         if (form.settings.requireEmailAuth) {
//             await sendEmail({
//                 send_to: recipient.email,
//                 subject: `Your PraxForm Verification Code`,
//                 sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
//                 reply_to: process.env.PRAXFORM_EMAIL_USER,
//                 template: 'submission-code',
//                 code: verificationCode
//             });
//         }
        
//         if (form.settings.requireSmsAuth) {
//             console.log(`SMS to ${recipient.phone}: Your code is ${verificationCode}`);
//         }

//         res.status(200).json({ verificationRequired: true, recipientEmail: recipient.email });
//         return;
//     }
//     // --- END SECURITY FLOW UPDATE ---

//     // If no auth is required, send the form data immediately.
//     const publicForm = { _id: form._id, name: form.name, description: form.description, fields: form.fields, encryptionKey: form.encryptionKey };
//     res.json(publicForm);
// });

// // @desc      Verify a 2FA code and get the form data
// // @route     POST /api/v1/submissions/verify-access
// // @access    Public
// const verifyAccessAndGetForm = asyncHandler(async (req, res) => {
//     const { formId, accessCode, verificationCode } = req.body;
//     const form = await Form.findById(formId);
//     if (!form) { res.status(404); throw new Error('Form not found'); }
    
//     const recipient = form.recipients.find(r => r.uniqueAccessCode === accessCode);
//     if (!recipient) { res.status(401); throw new Error('Invalid submission session.'); }

//     const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
//     if (
//         !recipient.verificationCode ||
//         recipient.verificationCode !== hashedCode ||
//         recipient.verificationCodeExpires < Date.now()
//     ) {
//         res.status(401);
//         throw new Error('Invalid or expired verification code.');
//     }

//     // If code is valid, clear it and send the form data
//     recipient.verificationCode = undefined;
//     recipient.verificationCodeExpires = undefined;
//     await form.save();

//     const publicForm = { _id: form._id, name: form.name, description: form.description, fields: form.fields, encryptionKey: form.encryptionKey };
//     res.status(200).json(publicForm);
// });


// // @desc      Create a new submission
// // @route     POST /api/v1/submissions
// // @access    Public
// const createSubmission = asyncHandler(async (req, res) => {
//     // This function now only handles the final submission of data.
//     // All verification has already happened.
//     const { formId, accessCode, encryptedData, files } = req.body;
//     const form = await Form.findById(formId).populate('organization').populate('createdBy', 'firstName lastName');
//     if (!form) { res.status(404); throw new Error('Form not found'); }

//     const recipient = form.recipients.find(r => r.uniqueAccessCode === accessCode);
//     const isPublicLink = form.publicLink?.enabled && form.publicLink?.uniqueAccessCode === accessCode;

//     if (!recipient && !isPublicLink) { res.status(403); throw new Error('Invalid access code for submission.'); }
//     if (recipient && form.settings.oneTimeUse && recipient.status === 'completed') { res.status(403); throw new Error('This form has already been submitted.'); }
    
//     // Plan limit enforcement
//     const organization = form.organization;
//     const maxSubmissions = organization.planLimits.maxSubmissionsPerMonth;
//     if (maxSubmissions !== -1) {
//         const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
//         const monthlyCount = await Submission.countDocuments({ organization: organization._id, createdAt: { $gte: startOfMonth } });
//         if (monthlyCount >= maxSubmissions) {
//             res.status(429);
//             throw new Error('This form is currently not accepting new submissions.');
//         }
//     }
    
//     const submission = new Submission({
//         form: formId,
//         organization: organization._id,
//         encryptedData,
//         files,
//         status: 'complete',
//         recipientEmail: recipient ? recipient.email : null
//     });
//     const createdSubmission = await submission.save();

//     if (form.createdBy) {
//         const message = `You have a new submission for the form: "${form.name}".`;
//         const link = `/forms/${form._id}/submissions/${createdSubmission._id}`;
//         await createNotification(form.createdBy._id, organization._id, 'form_submission', message, link);
//     }
    
//     form.submissionCount += 1;
//     if (recipient) {
//         recipient.status = 'completed';
//     }
//     await form.save();

//     await triggerWebhook('submission.created', createdSubmission.toObject(), organization._id);

//     res.status(201).json(createdSubmission);
// });


// // @desc      Get submissions for a form
// // @route     GET /api/v1/forms/:id/submissions
// // @access    Private
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

// // @desc      Get a single submission by ID
// // @route     GET /api/v1/submissions/:id
// // @access    Private
// const getSubmissionById = asyncHandler(async (req, res) => {
//     const submission = await Submission.findById(req.params.id);
//     if (submission && submission.organization.toString() === req.user.currentOrganization.toString()) {
//         res.json(submission);
//     } else {
//         res.status(404);
//         throw new Error('Submission not found or not part of the current organization');
//     }
// });

// // @desc      Delete a submission
// // @route     DELETE /api/v1/submissions/:id
// // @access    Private
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
//     verifyAccessAndGetForm,
//     getSubmissionsByForm, 
//     getSubmissionById, 
//     deleteSubmission 
// };




const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Submission = require('../models/Submission');
const Form = require('../models/Form');
const createNotification = require('../utils/createNotification');
const triggerWebhook = require('../utils/triggerWebhook');
const sendEmail = require('../utils/email/sendEmail');

// Helper to generate a 6-digit numeric code
const generateSixDigitCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// @desc      Get a form (or initiate verification if required)
// @route     GET /api/v1/submissions/:id/:accessCode
// @access    Public
const getPublicFormByAccessCode = asyncHandler(async (req, res) => {
    const { id, accessCode } = req.params;
    const form = await Form.findById(id);

    if (!form) { res.status(404); throw new Error('Form not found'); }
    if (form.settings.dueDate && new Date() > new Date(form.settings.dueDate)) { res.status(403); throw new Error('This form is past its due date.'); }
    if (form.status !== 'active') { res.status(403); throw new Error('This form is not currently active.'); }

    const recipient = form.recipients.find((r) => r.uniqueAccessCode === accessCode);
    const isPublicLink = form.publicLink?.enabled && form.publicLink?.uniqueAccessCode === accessCode;

    if (!recipient && !isPublicLink) { res.status(403); throw new Error('Invalid or expired access code'); }
    if (recipient && form.settings.oneTimeUse && recipient.status === 'completed') { res.status(403); throw new Error('This link has already been used.'); }

    if (form.settings.requireEmailAuth || form.settings.requireSmsAuth) {
        if (!recipient) {
            res.status(400);
            throw new Error("This secure form requires a specific recipient and cannot be accessed via a public link.");
        }

        const verificationCode = generateSixDigitCode();
        const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
        recipient.verificationCode = hashedCode;
        recipient.verificationCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await form.save();

        if (form.settings.requireEmailAuth) {
            await sendEmail({
                send_to: recipient.email,
                subject: `Your PraxForm Verification Code`,
                sent_from: `${process.env.PRAXFORM_FROM_NAME || 'PraxForm Team'} <${process.env.PRAXFORM_FROM_EMAIL || 'noreply@praxform.com'}>`,
                reply_to: process.env.PRAXFORM_EMAIL_USER,
                template: 'submission-code',
                code: verificationCode
            });
        }
        
        if (form.settings.requireSmsAuth) {
            console.log(`SMS to ${recipient.phone}: Your code is ${verificationCode}`);
        }

        res.status(200).json({ verificationRequired: true, recipientEmail: recipient.email });
        return;
    }

    const publicForm = { _id: form._id, name: form.name, description: form.description, fields: form.fields, encryptionKey: form.encryptionKey };
    res.json(publicForm);
});

// @desc      Verify a 2FA code and get the form data
// @route     POST /api/v1/submissions/verify-access
// @access    Public
const verifyAccessAndGetForm = asyncHandler(async (req, res) => {
    const { formId, accessCode, verificationCode } = req.body;
    const form = await Form.findById(formId);
    if (!form) { res.status(404); throw new Error('Form not found'); }
    
    const recipient = form.recipients.find(r => r.uniqueAccessCode === accessCode);
    if (!recipient) { res.status(401); throw new Error('Invalid submission session.'); }

    const hashedCode = crypto.createHash('sha256').update(verificationCode).digest('hex');
    if (
        !recipient.verificationCode ||
        recipient.verificationCode !== hashedCode ||
        recipient.verificationCodeExpires < Date.now()
    ) {
        res.status(401);
        throw new Error('Invalid or expired verification code.');
    }

    recipient.verificationCode = undefined;
    recipient.verificationCodeExpires = undefined;
    await form.save();

    const publicForm = { _id: form._id, name: form.name, description: form.description, fields: form.fields, encryptionKey: form.encryptionKey };
    res.status(200).json(publicForm);
});


// @desc      Create a new submission
// @route     POST /api/v1/submissions
// @access    Public
const createSubmission = asyncHandler(async (req, res) => {
    const { formId, accessCode, encryptedData, files } = req.body;
    const form = await Form.findById(formId).populate('organization').populate('createdBy', 'firstName lastName');
    if (!form) { res.status(404); throw new Error('Form not found'); }

    const recipient = form.recipients.find(r => r.uniqueAccessCode === accessCode);
    const isPublicLink = form.publicLink?.enabled && form.publicLink?.uniqueAccessCode === accessCode;

    if (!recipient && !isPublicLink) { res.status(403); throw new Error('Invalid access code for submission.'); }
    if (recipient && form.settings.oneTimeUse && recipient.status === 'completed') { res.status(403); throw new Error('This form has already been submitted.'); }
    
    const organization = form.organization;
    const maxSubmissions = organization.planLimits.maxSubmissionsPerMonth;
    if (maxSubmissions !== -1) {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const monthlyCount = await Submission.countDocuments({ organization: organization._id, createdAt: { $gte: startOfMonth } });
        if (monthlyCount >= maxSubmissions) {
            res.status(429);
            throw new Error('This form is currently not accepting new submissions.');
        }
    }
    
    const submission = new Submission({
        form: formId,
        organization: organization._id,
        encryptedData,
        files,
        status: 'complete',
        recipientEmail: recipient ? recipient.email : null
    });
    const createdSubmission = await submission.save();

    if (form.createdBy) {
        const message = `You have a new submission for the form: "${form.name}".`;
        const link = `/forms/${form._id}/submissions/${createdSubmission._id}`;
        await createNotification(form.createdBy._id, organization._id, 'form_submission', message, link);
    }
    
    form.submissionCount += 1;
    if (recipient) {
        recipient.status = 'completed';
    }
    await form.save();

    await triggerWebhook('submission.created', createdSubmission.toObject(), organization._id);

    res.status(201).json(createdSubmission);
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

// @desc      Confirms access for a download, allowing the audit middleware to log the event
// @route     POST /api/v1/submissions/:id/log-download
// @access    Private
const logSubmissionDownload = asyncHandler(async (req, res) => {
    // We only need to verify that the user has access. The audit middleware does the logging.
    const submission = await Submission.findById(req.params.id);
    if (!submission || submission.organization.toString() !== req.user.currentOrganization.toString()) {
        res.status(404);
        throw new Error('Submission not found');
    }
    // If we get here, the user has access, and the middleware will log the success.
    res.status(200).json({ message: 'Download event acknowledged.' });
});


module.exports = { 
    createSubmission, 
    getPublicFormByAccessCode,
    verifyAccessAndGetForm,
    getSubmissionsByForm, 
    getSubmissionById, 
    deleteSubmission,
    logSubmissionDownload 
};