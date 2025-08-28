const express = require('express');
const router = express.Router();
const {
    createFormTemplate,
    getFormTemplates,
    getFormTemplateById,
    updateFormTemplate,
    deleteFormTemplate,
} = require('../controllers/formtemplateController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createFormTemplate)
    .get(protect, getFormTemplates);

router.route('/:id')
    .get(protect, getFormTemplateById)
    .put(protect, updateFormTemplate)
    .delete(protect, deleteFormTemplate);

module.exports = router;
