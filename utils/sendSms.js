const twilio = require('twilio');

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Check if all required environment variables are set
if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.error("Twilio environment variables are not fully configured.");
  
  module.exports = async () => {
    console.error("SMS sending is disabled due to missing Twilio configuration.");
    throw new Error("Twilio service is not configured.");
    return Promise.resolve(); 
  };
} else {
  const client = twilio(accountSid, authToken);

  /**
   * Sends an SMS message using Twilio.
   * @param {string} to The recipient's phone number (in E.164 format, e.g., +14155552671).
   * @param {string} body The text message to send.
   */
  const sendSms = async (to, body) => {
    try {
      const message = await client.messages.create({
        body: body,
        from: twilioPhoneNumber,
        to: to,
      });
      console.log(`SMS sent successfully to ${to}. Message SID: ${message.sid}`);
    } catch (error) {
      console.error(`Failed to send SMS to ${to}:`, error);
      // Depending on your app's needs, you might want to re-throw the error
      // to let the calling function handle it.
      throw new Error('Failed to send verification SMS.');
    }
  };

  module.exports = sendSms;
}