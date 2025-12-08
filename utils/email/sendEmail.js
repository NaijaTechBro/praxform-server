const SibApiV3Sdk = require('sib-api-v3-sdk');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const Settings = require('../../models/Settings');
const Mailjet = require('node-mailjet');

// --- Helper: Render Templates ---
const renderTemplate = (templateName, data) => {
    const filePath = path.join(__dirname, `../../emails/${templateName}.handlebars`);
    const source = fs.readFileSync(filePath, 'utf-8').toString();
    const template = handlebars.compile(source);
    const dataWithYear = { ...data, currentYear: new Date().getFullYear() };
    return template(dataWithYear);
};

// --- Service 1: Brevo ---
const sendEmailWithBrevo = async (options) => {
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications['api-key'];
    apiKey.apiKey = process.env.BREVO_API_KEY;

    const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
    
    // Parse "Name <email>" format
    const match = options.sent_from.match(/(.*) <(.*)>/);
    const sender = {
        name: match ? match[1].trim() : options.sent_from.replace(/ <.*>/, ''),
        email: match ? match[2].trim() : options.sent_from.match(/<(.*)>/)[1],
    };

    const htmlContent = renderTemplate(options.template, {
        name: options.name,
        link: options.link,
        ...options // Pass extra data like 'code'
    });

    console.log(`📧 [Brevo] Sending to: ${options.send_to}`);

    await tranEmailApi.sendTransacEmail({
        sender,
        to: [{ email: options.send_to }],
        subject: options.subject,
        replyTo: { email: options.reply_to },
        htmlContent: htmlContent,
    });
};

// --- Service 2: Nodemailer ---
const sendEmailWithNodemailer = async (options) => {
    const transporter = nodemailer.createTransport({
        host: process.env.PRAXFORM_EMAIL_HOST,
        port: process.env.PRAXFORM_EMAIL_PORT,
        secure: true,
        auth: {
            user: process.env.PRAXFORM_EMAIL_USER,
            pass: process.env.PRAXFORM_EMAIL_PASS,
        },
    });

    const htmlContent = renderTemplate(options.template, {
        name: options.name,
        link: options.link,
        ...options
    });

    console.log(`📧 [Nodemailer] Sending to: ${options.send_to}`);

    await transporter.sendMail({
        from: options.sent_from,
        to: options.send_to,
        replyTo: options.reply_to,
        subject: options.subject,
        html: htmlContent,
    });
};

// --- Service 3: Mailjet ---
const sendEmailWithMailjet = async (options) => {
    try {
        const mailjetClient = Mailjet.apiConnect(
            process.env.MAILJET_API_KEY, 
            process.env.MAILJET_SECRET_KEY
        );

        const match = options.sent_from.match(/(.*) <(.*)>/);
        const fromName = match ? match[1].trim() : "Praxform Team";
        const fromEmail = match ? match[2].trim() : options.sent_from;
        
        const htmlContent = renderTemplate(options.template, {
            name: options.name,
            link: options.link,
            ...options
        });

        console.log(`📧 [Mailjet] Sending to: ${options.send_to}`);

        const result = await mailjetClient.post('send', { version: 'v3.1' }).request({
            Messages: [
                {
                    From: { Email: fromEmail, Name: fromName },
                    To: [{ Email: options.send_to }],
                    Subject: options.subject,
                    HTMLPart: htmlContent,
                    Headers: { 'Reply-To': options.reply_to },
                },
            ],
        });

        if (result.response.status !== 200 && result.response.status !== 201) {
             throw new Error(`Mailjet status: ${result.response.status}`);
        }
    } catch (error) {
        console.error("MAILJET ERROR:", error.message);
        throw error;
    }
};

// --- Main Export with Auto-Initialization ---
const sendEmail = async (options) => {
    // 1. Fetch settings
    let currentSettings = await Settings.findOne({ singleton: 'main_settings' });

    // 2. SELF-HEALING: If missing, create it immediately.
    // This fixes the "Missing DB" issue and ensures Mailjet is the default.
    if (!currentSettings) {
        console.log("⚠️ Settings collection not found. Creating default 'mailjet' configuration...");
        currentSettings = await Settings.create({
            singleton: 'main_settings',
            emailProvider: 'mailjet' 
        });
    }

    const provider = currentSettings.emailProvider;
    console.log(`⚙️ Using Email Provider: ${provider.toUpperCase()}`);

    if (provider === 'mailjet') {
        return sendEmailWithMailjet(options);
    } else if (provider === 'brevo') {
        return sendEmailWithBrevo(options);
    } else {
        return sendEmailWithNodemailer(options);
    }
};

module.exports = { sendEmail };