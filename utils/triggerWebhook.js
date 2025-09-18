const axios = require('axios');
const crypto = require('crypto');
const Webhook = require('../models/Webhook');

/**
 * Finds and sends webhooks for a given event.
 * @param {string} eventName 
 * @param {object} payload 
 * @param {string} organizationId 
 */
const triggerWebhook = async (eventName, payload, organizationId) => {
    try {
        // 1. Find all active webhooks for this org that are subscribed to this event
        const webhooks = await Webhook.find({
            organization: organizationId,
            events: eventName,
            status: 'active'
        });

        if (webhooks.length === 0) {
            return; 
        }

        const payloadString = JSON.stringify(payload);

        // 2. Send the webhook to each endpoint
        for (const webhook of webhooks) {
            // 3. Create a unique signature for security
            const signature = crypto
                .createHmac('sha256', webhook.secret)
                .update(payloadString)
                .digest('hex');

            // 4. Send the request
            axios.post(webhook.endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Praxform-Signature': signature 
                }
            }).catch(error => {
                console.error(`Webhook failed for endpoint ${webhook.endpoint}:`, error.message);
            });
        }
    } catch (error) {
        console.error('Error triggering webhook:', error);
    }
};

module.exports = triggerWebhook;