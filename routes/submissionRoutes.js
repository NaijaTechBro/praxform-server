// const express = require('express');
// const router = express.Router();
// const {
//     createSubmission,
//     getSubmissionById,
//     deleteSubmission,
//     getSubmissionsByForm,
//     getPublicFormByAccessCode,
//     verifyAccessAndGetForm, 
// } = require('../controllers/submissionController');
// const { protect } = require('../middleware/authMiddleware');
// const audit = require('../middleware/auditMiddleware');

// router.post('/', createSubmission);
// router.post('/verify-access', verifyAccessAndGetForm);

// router.get('/:id/:accessCode', getPublicFormByAccessCode);

// router.get('/form/:id', protect, getSubmissionsByForm);
// router.route('/:id')
//     .get(protect, audit('submission.viewed', 'submission'), getSubmissionById)
//     .delete(protect, audit('submission.deleted', 'submission'), deleteSubmission);

// module.exports = router;



const express = require('express');
const router = express.Router();
const {
    createSubmission,
    getSubmissionById,
    deleteSubmission,
    getSubmissionsByForm,
    getPublicFormByAccessCode,
    verifyAccessAndGetForm, 
    logSubmissionDownload,
} = require('../controllers/submissionController');
const { protect } = require('../middleware/authMiddleware');
const audit = require('../middleware/auditMiddleware');

router.post('/', createSubmission);
router.post('/verify-access', verifyAccessAndGetForm);

router.get('/:id/:accessCode', getPublicFormByAccessCode);

router.get('/form/:id', protect, getSubmissionsByForm);

router.route('/:id')
    .get(protect, audit('submission.viewed', 'submission'), getSubmissionById)
    .delete(protect, audit('submission.deleted', 'submission'), deleteSubmission);

// New: Route to log a download, protected by the audit middleware
router.post('/:id/log-download', protect, audit('submission.downloaded', 'submission'), logSubmissionDownload);

module.exports = router;