const SibApiV3Sdk = require('sib-api-v3-sdk');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

// Helper function to read an email template and compile it with Handlebars
const renderTemplate = (templateName, data) => {
    try {
        const filePath = path.join(__dirname, `../../emails/${templateName}.handlebars`);
        const source = fs.readFileSync(filePath, 'utf-8').toString();
        const template = handlebars.compile(source);
        // Add current year to all templates for the footer
        const dataWithYear = { ...data, currentYear: new Date().getFullYear() };
        return template(dataWithYear);
    } catch (error) {
        console.error(`Error rendering email template: ${templateName}`, error);
        throw new Error('Could not render email template.');
    }
};

const sendEmail = async (options) => {
    const { subject, send_to, sent_from, reply_to, template, ...context } = options;

    if (!template) {
        console.error("Email template name is required!");
        throw new Error("Email template name is required!");
    }
    if (!process.env.BREVO_API_KEY) {
        console.error("Brevo API key is missing from environment variables.");
        throw new Error("Email service is not configured.");
    }

    // --- Configure Brevo API Client ---
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications['api-key'];
    apiKey.apiKey = process.env.BREVO_API_KEY;
    const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

    // --- Prepare Email Details ---
    // Brevo requires name and email to be separate
    const sender = {
        email: sent_from.match(/<(.*)>/)[1], // Extracts email from "Name <email@example.com>"
        name: sent_from.replace(/ <.*>/, ''),
    };
    const receivers = [{ email: send_to }];
    
    // Render the HTML content from your .handlebars file
    const htmlContent = renderTemplate(template, context);

    console.log(`📧 Sending email via Brevo to: ${send_to}`);

    // --- Send the Email ---
    try {
        const result = await tranEmailApi.sendTransacEmail({
            sender,
            to: receivers,
            subject,
            replyTo: { email: reply_to },
            htmlContent: htmlContent,
        });
        console.log('Email sent successfully via Brevo API:', result);
        return result;
    } catch (error) {
        console.error('Brevo API Error:', error.response?.text || error.message);
        throw new Error('Failed to send email via Brevo API.');
    }
};

module.exports = sendEmail;





// const nodemailer = require('nodemailer');
// const hbs = require('nodemailer-express-handlebars').default;
// const path = require('path');

// const sendEmail = async (options) => {
//     // Extract all properties from options objects
//     const {
//         subject,
//         send_to,
//         sent_from,
//         reply_to,
//         template,
//         ...context
//     } = options;

//     // Validate template parameter
//     if (!template) {
//         console.error("Email template name is required!");
//         return false;
//     }

//     const transporter = nodemailer.createTransport({
//         host: process.env.PRAXFORM_EMAIL_HOST,
//         port: process.env.PRAXFORM_EMAIL_PORT,
//         auth: {
//             user: process.env.PRAXFORM_EMAIL_USER,
//             pass: process.env.PRAXFORM_EMAIL_PASS,
//         },
//         tls: {
//             rejectUnauthorized: false,
//         },
//     });

//     const handlebarOptions = {
//         viewEngine: {
//             extname: '.handlebars',
//             partialsDir: path.resolve('./emails'),
//             defaultLayout: false,
//         },
//         viewPath: path.resolve('./emails'),
//         extName: '.handlebars',
//     };

//     console.log("📧 Using email template:", template);

//     transporter.use('compile', hbs(handlebarOptions));

//     const mailOptions = {
//         from: sent_from,
//         to: send_to,
//         replyTo: reply_to,
//         subject: subject,
//         template: template,
//         context: context,
//     };

//     // Return a promise for better error handling
//     return new Promise((resolve, reject) => {
//         transporter.sendMail(mailOptions, function (err, info) {
//             if (err) {
//                 console.log('Email sending failed:', err);
//                 reject(err);
//             } else {
//                 console.log('Email sent:', info.response);
//                 resolve(info);
//             }
//         });
//     });
// };

// module.exports = sendEmail;



