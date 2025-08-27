const express = require('express');
const router = express.Router();
const {
    createSubmission,
    getSubmissionById,
    deleteSubmission,
    getPublicFormByAccessCode 
} = require('../controllers/submissionController');
const { protect } = require('../middleware/authMiddleware');
const audit = require('../middleware/auditMiddleware');

router.post('/', createSubmission);

router.get('/:id/:accessCode', getPublicFormByAccessCode);


router.route('/:id')
    .get(protect, audit('submission.viewed', 'submission'), getSubmissionById)
    .delete(protect, audit('submission.deleted', 'submission'), deleteSubmission);

module.exports = router;