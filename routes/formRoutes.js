const express = require('express');
const router = express.Router();
const { 
    createForm, 
    getForms, 
    getFormById, 
    updateForm, 
    deleteForm, 
    sendForm 
} = require('../controllers/formController');
const { getSubmissionsByForm } = require('../controllers/submissionController');
const { protect } = require('../middleware/authMiddleware');
const audit = require('../middleware/auditMiddleware');

router.route('/')
    .post(protect, audit('form.created', 'form'), createForm)
    .get(protect, getForms);

router.route('/:id')
    .get(protect, getFormById) 
    .put(protect, audit('form.updated', 'form'), updateForm)
    .delete(protect, audit('form.deleted', 'form'), deleteForm);

router.post('/:id/send', protect, audit('form.sent', 'form'), sendForm);

router.get('/:id/submissions', protect, getSubmissionsByForm);

module.exports = router;