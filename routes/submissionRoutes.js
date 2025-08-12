const express = require('express');
const router = express.Router();
const { 
    createSubmission, 
    getSubmissionById, 
    deleteSubmission 
} = require('../controllers/submissionController');
const { protect } = require('../middleware/authMiddleware');
const audit = require('../middleware/auditMiddleware');

// Public endpoint does not get user-specific audit middleware here
// The controller could manually create a log if needed
router.post('/', createSubmission); 

// Protected endpoints for managing submissions
router.route('/:id')
    .get(protect, audit('submission.viewed', 'submission'), getSubmissionById)
    .delete(protect, audit('submission.deleted', 'submission'), deleteSubmission);

module.exports = router;