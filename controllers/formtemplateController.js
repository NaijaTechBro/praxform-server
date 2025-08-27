const asyncHandler = require('express-async-handler');
const FormTemplate = require('../models/FormTemplate'); 

// @desc    Create a new form template
// @route   POST /api/v1/form-templates
// @access  Private
const createFormTemplate = asyncHandler(async (req, res) => {
    const { name, description, isPublic, category, fields } = req.body;
    const organizationId = req.user.currentOrganization; 

    if (!organizationId) {
        res.status(400);
        throw new Error('User does not have a current organization selected');
    }

    // Basic validation for fields structure
    if (!Array.isArray(fields) || fields.some(field => !field.type || !field.label)) {
        res.status(400);
        throw new Error('Form fields must be an array of objects with at least a type and label.');
    }

    const formTemplate = new FormTemplate({
        name,
        description,
        organization: organizationId,
        isPublic: isPublic || false, // Default to private if not specified
        category: category || 'other',
        fields,
        createdBy: req.user._id,
    });

    const createdTemplate = await formTemplate.save();
    res.status(201).json(createdTemplate);
});

// @desc    Get all form templates (public and organization-specific)
// @route   GET /api/v1/form-templates
// @access  Private
const getFormTemplates = asyncHandler(async (req, res) => {
    const organizationId = req.user.currentOrganization;

    if (!organizationId) {
        res.status(400);
        throw new Error('User does not have a current organization selected');
    }

    // Find templates that are public OR belong to the user's organization
    const templates = await FormTemplate.find({
        $or: [
            { isPublic: true },
            { organization: organizationId }
        ]
    }).populate('createdBy', 'firstName lastName').sort({ createdAt: -1 }); // Sort by creation date

    res.json(templates);
});

// @desc    Get a single form template by ID
// @route   GET /api/v1/form-templates/:id
// @access  Private
const getFormTemplateById = asyncHandler(async (req, res) => {
    const template = await FormTemplate.findById(req.params.id);

    if (!template) {
        res.status(404);
        throw new Error('Form template not found');
    }

    // Check if the template is public or belongs to the user's organization
    const isAuthorized = template.isPublic || (template.organization && template.organization.toString() === req.user.currentOrganization.toString());

    if (isAuthorized) {
        res.json(template);
    } else {
        res.status(403);
        throw new Error('Not authorized to access this form template');
    }
});

// @desc    Update a form template
// @route   PUT /api/v1/form-templates/:id
// @access  Private/Owner
const updateFormTemplate = asyncHandler(async (req, res) => {
    const { name, description, isPublic, category, fields } = req.body;
    const template = await FormTemplate.findById(req.params.id);

    if (!template) {
        res.status(404);
        throw new Error('Form template not found');
    }

    // Only allow owner of the template's organization to update
    if (template.organization.toString() !== req.user.currentOrganization.toString()) {
        res.status(403);
        throw new Error('Not authorized to update this form template');
    }

    template.name = name || template.name;
    template.description = description || template.description;
    template.isPublic = typeof isPublic === 'boolean' ? isPublic : template.isPublic;
    template.category = category || template.category;
    template.fields = fields || template.fields; // Allows updating the fields array

    const updatedTemplate = await template.save();
    res.json(updatedTemplate);
});

// @desc    Delete a form template
// @route   DELETE /api/v1/form-templates/:id
// @access  Private/Owner
const deleteFormTemplate = asyncHandler(async (req, res) => {
    const template = await FormTemplate.findById(req.params.id);

    if (!template) {
        res.status(404);
        throw new Error('Form template not found');
    }

    // Only allow owner of the template's organization to delete
    if (template.organization.toString() !== req.user.currentOrganization.toString()) {
        res.status(403);
        throw new Error('Not authorized to delete this form template');
    }

    await template.remove();
    res.json({ message: 'Form template removed successfully' });
});

module.exports = {
    createFormTemplate,
    getFormTemplates,
    getFormTemplateById,
    updateFormTemplate,
    deleteFormTemplate,
};
