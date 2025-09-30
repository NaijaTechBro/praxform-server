const ContactInquiry = require('../models/ContactInquiry');
const { sendAdminContactNotification } = require('../utils/emailService');

exports.submitInquiry = async (req, res) => {
    try {
        const { firstName, lastName, phoneNumber, email, additionalInformation } = req.body;

        if (!firstName || !lastName || !email || !additionalInformation) {
            return res.status(400).json({ success: false, message: 'Please fill out all required fields.' });
        }

        const newInquiry = await ContactInquiry.create({
            firstName,
            lastName,
            email,
            phoneNumber,
            message: additionalInformation
        });

        // Send the admin notification email
        try {
            await sendAdminContactNotification(newInquiry);
        } catch (emailError) {
            console.error("Failed to send admin notification email:", emailError);
            // Don't block the user response if the email fails
        }

        res.status(201).json({
            success: true,
            message: 'Thank you for your message! We will get back to you shortly.'
        });

    } catch (error) {
        console.error('Contact Inquiry Error:', error);
        res.status(500).json({ success: false, message: 'Server Error: Could not submit your message.' });
    }
};