// const twilio = require('twilio');

// // Initialize Twilio client
// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
// const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// // Check if all required environment variables are set
// if (!accountSid || !authToken || !twilioPhoneNumber) {
//   console.error("Twilio environment variables are not fully configured.");
  
//   module.exports = async () => {
//     console.error("SMS sending is disabled due to missing Twilio configuration.");
//     throw new Error("Twilio service is not configured.");
//     return Promise.resolve(); 
//   };
// } else {
//   const client = twilio(accountSid, authToken);

//   /**
//    * Sends an SMS message using Twilio.
//    * @param {string} to The recipient's phone number (in E.164 format, e.g., +14155552671).
//    * @param {string} body The text message to send.
//    */
//   const sendSms = async (to, body) => {
//     try {
//       const message = await client.messages.create({
//         body: body,
//         from: twilioPhoneNumber,
//         to: to,
//       });
//       console.log(`SMS sent successfully to ${to}. Message SID: ${message.sid}`);
//     } catch (error) {
//       console.error(`Failed to send SMS to ${to}:`, error);
//       // Depending on your app's needs, you might want to re-throw the error
//       // to let the calling function handle it.
//       throw new Error('Failed to send verification SMS.');
//     }
//   };

//   module.exports = sendSms;
// }

const axios = require('axios');

const TERMII_BASE_URL = 'https://v3.api.termii.com';
const API_KEY = process.env.TERMII_API_KEY;
const SENDER_ID = process.env.TERMII_SENDER_ID;

/**
 * Sends an OTP via Termii Send Token API
 * @param {string} phone - Recipient phone in international format (e.g. 234...)
 * @returns {string} pinId - The ID needed to verify this specific OTP later
 */
const sendOTP = async (phone) => {
    const payload = {
        api_key: API_KEY,
        message_type: "NUMERIC",
        to: phone,
        from: SENDER_ID,
        channel: "dnd", 
        pin_attempts: 3,
        pin_time_to_live: 10,
        pin_length: 6,
        pin_placeholder: "< 123456 >",
        message_text: "Your PraxForm verification code is < 123456 >. It expires in 10 minutes.",
        pin_type: "NUMERIC"
    };

    const { data } = await axios.post(`${TERMII_BASE_URL}/api/sms/otp/send`, payload);
    return data.pin_id; // Store this in your DB to verify later
};

/**
 * Verifies an OTP via Termii Verify Token API
 * @param {string} pinId - The pin_id returned during the send process
 * @param {string} pin - The 6-digit code entered by the user
 */
const verifyOTP = async (pinId, pin) => {
    const payload = {
        api_key: API_KEY,
        pin_id: pinId,
        pin: pin
    };

    const { data } = await axios.post(`${TERMII_BASE_URL}/api/sms/otp/verify`, payload);
    return data.verified === "True" || data.verified === true;
};

module.exports = { sendOTP, verifyOTP };