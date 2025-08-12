const mongoose = require('mongoose');

const WebhookSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    endpoint: { type: String, required: true, trim: true },
    secret: { type: String, required: true },
    events: [{ type: String, required: true }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const Webhook = mongoose.model('Webhook', WebhookSchema);
module.exports = Webhook;