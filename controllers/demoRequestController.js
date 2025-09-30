const DemoRequest = require('../models/DemoRequest');
// Import the email service functions
const { sendAdminDemoNotification, sendDemoConfirmation } = require('../utils/emailService');

exports.submitDemoRequest = async (req, res) => {
    try {
        const { firstName, lastName, phoneNumber, emailAddress } = req.body;

        if (!firstName || !lastName || !emailAddress || !phoneNumber) {
            return res.status(400).json({ success: false, message: 'Please provide all required information.' });
        }

        const newDemoRequest = await DemoRequest.create({
            firstName,
            lastName,
            email: emailAddress,
            phoneNumber
        });

        // Send notification emails in parallel
        try {
            await Promise.all([
                sendAdminDemoNotification(newDemoRequest),
                sendDemoConfirmation(newDemoRequest)
            ]);
        } catch (emailError) {
            console.error("Failed to send demo request emails:", emailError);
        }

        res.status(201).json({
            success: true,
            message: 'Your demo request has been received! Our team will contact you soon to schedule a time.'
        });

    } catch (error)
        {
        console.error('Demo Request Error:', error);
        res.status(500).json({ success: false, message: 'Server Error: Could not process your request.' });
    }
};