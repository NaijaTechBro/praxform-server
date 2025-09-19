const express = require('express');
const router = express.Router();
const {
    createSubmission,
    getSubmissionById,
    deleteSubmission,
    getSubmissionsByForm,
    getPublicFormByAccessCode,
    verifyAccessAndGetForm, 
    logSubmissionView,
    logSubmissionDownload,
} = require('../controllers/submissionController');
const { protect } = require('../middleware/authMiddleware');
const audit = require('../middleware/auditMiddleware');

router.post('/', createSubmission);
router.post('/verify-access', verifyAccessAndGetForm);

router.get('/:id/:accessCode', getPublicFormByAccessCode);

router.get('/form/:id', protect, getSubmissionsByForm);

router.route('/:id')
    .get(protect, getSubmissionById)
    .delete(protect, audit('submission.deleted', 'submission'), deleteSubmission);

router.post('/:id/log-view', protect, audit('submission.viewed', 'submission'), logSubmissionView);

router.post('/:id/log-download', protect, audit('submission.downloaded', 'submission'), logSubmissionDownload);

module.exports = router;