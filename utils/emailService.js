// const sendEmail = require('./email/sendEmail');

// // Email to notify admin of a new contact message
// const sendAdminContactNotification = async (inquiryData) => {
//     const options = {
//         subject: `New Contact Inquiry from ${inquiryData.firstName}`,
//         send_to: process.env.ADMIN_EMAIL, 
//         sent_from: process.env.PRAXFORM_EMAIL_USER,
//         template: 'newInquiryAdmin',
//         ...inquiryData
//     };
//     return sendEmail(options);
// };

// // Email to notify sales team of a new demo request
// const sendAdminDemoNotification = async (demoData) => {
//     const options = {
//         subject: `🔥 New Demo Request: ${demoData.firstName} ${demoData.lastName}`,
//         send_to: process.env.SALES_EMAIL,
//         sent_from: process.env.PRAXFORM_EMAIL_USER,
//         template: 'newDemoRequestAdmin',
//         ...demoData
//     };
//     return sendEmail(options);
// };

// const sendDemoConfirmation = async (userData) => {
//     const options = {
//         subject: "We've Received Your Demo Request!",
//         send_to: userData.email,
//         sent_from: process.env.PRAXFORM_EMAIL_USER,
//         template: 'demoRequestConfirmation',
//         name: userData.firstName,
//         email: userData.email
//     };
//     return sendEmail(options);
// };


// module.exports = {
//     sendAdminContactNotification,
//     sendAdminDemoNotification,
//     sendDemoConfirmation
// };




const sendEmail = require('./email/sendEmail');

// Email to notify admin of a new contact message
const sendAdminContactNotification = async (inquiryData) => {
    const options = {
        subject: `New Contact Inquiry from ${inquiryData.firstName}`,
        send_to: process.env.ADMIN_EMAIL,
        sent_from: process.env.PRAXFORM_FROM_EMAIL,
        template: 'newInquiryAdmin',
        ...inquiryData.toObject() 
    };
    return sendEmail(options);
};

// Email to notify sales team of a new demo request
const sendAdminDemoNotification = async (demoData) => {
    const options = {
        subject: `🔥 New Demo Request: ${demoData.firstName} ${demoData.lastName}`,
        send_to: process.env.SALES_EMAIL,
        sent_from: process.env.PRAXFORM_FROM_EMAIL,
        template: 'newDemoRequestAdmin',
        ...demoData.toObject()
    };
    return sendEmail(options);
};

// Email to the user confirming their demo request
const sendDemoConfirmation = async (userData) => {
    const options = {
        subject: "We've Received Your Demo Request!",
        send_to: userData.email,
        sent_from: process.env.PRAXFORM_FROM_EMAIL,
        template: 'demoRequestConfirmation',
        name: userData.firstName,
        email: userData.email
    };
    return sendEmail(options);
};


module.exports = {
    sendAdminContactNotification,
    sendAdminDemoNotification,
    sendDemoConfirmation
};