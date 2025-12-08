const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    singleton: { type: String, default: 'main_settings', unique: true },
    emailProvider: { type: String, enum: ['nodemailer', 'brevo', 'mailjet'], default: 'mailjet' },
});

const Settings = mongoose.model('Settings', SettingsSchema);
module.exports = Settings;