const nodemailer = require('nodemailer');
const hbs = require('nodemailer-express-handlebars').default;
const path = require('path');

const sendEmail = async (options) => {
    // Extract all properties from options objects
    const {
        subject,
        send_to,
        sent_from,
        reply_to,
        template,
        ...context
    } = options;

    // Validate template parameter
    if (!template) {
        console.error("Email template name is required!");
        return false;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.PRAXFORM_EMAIL_HOST,
        port: process.env.PRAXFORM_EMAIL_PORT,
        auth: {
            user: process.env.PRAXFORM_EMAIL_USER,
            pass: process.env.PRAXFORM_EMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    const handlebarOptions = {
        viewEngine: {
            extname: '.handlebars',
            partialsDir: path.resolve('./emails'),
            defaultLayout: false,
        },
        viewPath: path.resolve('./emails'),
        extName: '.handlebars',
    };

    console.log("📧 Using email template:", template);

    transporter.use('compile', hbs(handlebarOptions));

    const mailOptions = {
        from: sent_from,
        to: send_to,
        replyTo: reply_to,
        subject: subject,
        template: template,
        context: context,
    };

    // Return a promise for better error handling
    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, function (err, info) {
            if (err) {
                console.log('Email sending failed:', err);
                reject(err);
            } else {
                console.log('Email sent:', info.response);
                resolve(info);
            }
        });
    });
};

module.exports = sendEmail;




// const nodemailer = require('nodemailer');
// const hbs = require('nodemailer-express-handlebars').default;
// const path = require('path');

// // --- 1. Create the transporter ONCE (for efficiency) ---
// // This avoids creating a new connection pool for every email.
// const transporter = nodemailer.createTransport({
//     host: process.env.PRAXFORM_EMAIL_HOST,
//     port: process.env.PRAXFORM_EMAIL_PORT,
//     // --- 2. IMPORTANT: Added 'secure' option ---
//     // 'true' for port 465, 'false' for all other ports (like 587)
//     secure: process.env.PRAXFORM_EMAIL_PORT == 465,
//     auth: {
//         user: process.env.PRAXFORM_EMAIL_USER,
//         pass: process.env.PRAXFORM_EMAIL_PASS,
//     },
//     // --- 3. REMOVED for security ---
//     // tls: {
//     //   rejectUnauthorized: false,
//     // },
// });

// // Configure Handlebars templating engine
// const handlebarOptions = {
//     viewEngine: {
//         extname: '.handlebars',
//         // Corrected path to navigate up two directories
//         partialsDir: path.resolve(__dirname, '../../emails'),
//         defaultLayout: false,
//     },
//     // Corrected path for the view templates
//     viewPath: path.resolve(__dirname, '../../emails'),
//     extName: '.handlebars',
// };
// // // --- Configure Handlebars templating engine ---
// // const handlebarOptions = {
// //     viewEngine: {
// //         extname: '.handlebars',
// //         // Use __dirname for a more reliable path
// //         partialsDir: path.resolve(__dirname, 'emails'),
// //         defaultLayout: false,
// //     },
// //     viewPath: path.resolve(__dirname, 'emails'),
// //     extName: '.handlebars',
// // };

// // Attach the Handlebars plugin to the transporter
// transporter.use('compile', hbs(handlebarOptions));


// const sendEmail = async (options) => {
//     // --- 4. DEBUGGING: Uncomment to verify your environment variables ---
//     /*
//     console.log('--- Email Config ---');
//     console.log('HOST:', process.env.PRAXFORM_EMAIL_HOST);
//     console.log('PORT:', process.env.PRAXFORM_EMAIL_PORT);
//     console.log('SECURE:', process.env.PRAXFORM_EMAIL_PORT == 465);
//     console.log('USER:', process.env.PRAXFORM_EMAIL_USER);
//     console.log('--- Sending To ---');
//     console.log('TO:', options.send_to);
//     console.log('SUBJECT:', options.subject);
//     console.log('TEMPLATE:', options.template);
//     */

//     const {
//         subject,
//         send_to,
//         sent_from,
//         reply_to,
//         template,
//         ...context // All other properties are passed to the template
//     } = options;

//     if (!template) {
//         throw new Error("Email template name ('template') is required in options.");
//     }

//     const mailOptions = {
//         from: sent_from,
//         to: send_to,
//         replyTo: reply_to,
//         subject: subject,
//         template: template,
//         context: context, // Pass the dynamic data to the template
//     };

//     try {
//         // --- 5. Use modern async/await for cleaner code ---
//         console.log(`📧 Using email template: ${template}`);
//         const info = await transporter.sendMail(mailOptions);
//         console.log('✅ Email sent successfully:', info.response);
//         return info;
//     } catch (err) {
//         console.error(`❌ Failed to send email to ${send_to}:`, err);
//         // Re-throw the error so the calling function knows something went wrong
//         throw err;
//     }
// };

// module.exports = sendEmail;