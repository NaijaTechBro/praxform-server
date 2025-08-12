const asyncHandler = require('express-async-handler');
const Webhook = require('../models/Webhook');
const crypto = require('crypto');

// @desc    Create a webhook
// @route   POST /api/v1/webhooks
// @access  Private
const createWebhook = asyncHandler(async (req, res) => {
    const { name, endpoint, events } = req.body;
    const organizationId = req.user.currentOrganization;
    
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = new Webhook({
        name,
        organization: organizationId,
        endpoint,
        events,
        secret,
        createdBy: req.user._id,
    });

    const createdWebhook = await webhook.save();
    res.status(201).json(createdWebhook);
});

// @desc    Get all webhooks for an organization
// @route   GET /api/v1/webhooks
// @access  Private
const getWebhooks = asyncHandler(async (req, res) => {
    const organizationId = req.user.currentOrganization;
    const webhooks = await Webhook.find({ organization: organizationId });
    res.json(webhooks);
});

// @desc    Update a webhook
// @route   PUT /api/v1/webhooks/:id
// @access  Private
const updateWebhook = asyncHandler(async (req, res) => {
    const webhook = await Webhook.findById(req.params.id);

    if (webhook && webhook.organization.toString() === req.user.currentOrganization.toString()) {
        webhook.name = req.body.name || webhook.name;
        webhook.endpoint = req.body.endpoint || webhook.endpoint;
        webhook.events = req.body.events || webhook.events;
        webhook.status = req.body.status || webhook.status;

        const updatedWebhook = await webhook.save();
        res.json(updatedWebhook);
    } else {
        res.status(404);
        throw new Error('Webhook not found or not part of the current organization');
    }
});

// @desc    Delete a webhook
// @route   DELETE /api/v1/webhooks/:id
// @access  Private
const deleteWebhook = asyncHandler(async (req, res) => {
    const webhook = await Webhook.findById(req.params.id);
    
    if (webhook && webhook.organization.toString() === req.user.currentOrganization.toString()) {
        await webhook.remove();
        res.json({ message: 'Webhook removed' });
    } else {
        res.status(404);
        throw new Error('Webhook not found or not part of the current organization');
    }
});

module.exports = { createWebhook, getWebhooks, updateWebhook, deleteWebhook };