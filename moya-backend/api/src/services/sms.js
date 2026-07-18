/**
 * SMS service — sends a one-time-password to a phone number.
 *
 * Priority:
 *   1. Africa's Talking  — when AT_API_KEY + AT_USERNAME are set (recommended for East Africa)
 *   2. Twilio            — when TWILIO_SID + TWILIO_TOKEN + TWILIO_FROM are set
 *   3. Console fallback  — for local development; never throws
 */

async function sendOTP(phone, code) {
  const atKey  = process.env.AT_API_KEY;
  const atUser = process.env.AT_USERNAME;

  if (atKey && atUser) {
    const AfricasTalking = require("africastalking");
    const at = AfricasTalking({ apiKey: atKey, username: atUser });
    const sms = at.SMS;
    await sms.send({
      to:      [phone],
      message: `Your Moya verification code is: ${code}`,
      from:    process.env.AT_SENDER || "Moya",
    });
    return;
  }

  const twilioSid   = process.env.TWILIO_SID;
  const twilioToken = process.env.TWILIO_TOKEN;
  const twilioFrom  = process.env.TWILIO_FROM;

  if (twilioSid && twilioToken && twilioFrom) {
    const twilio = require("twilio");
    const client = twilio(twilioSid, twilioToken);
    await client.messages.create({
      body: `Your Moya verification code is: ${code}`,
      from: twilioFrom,
      to:   phone,
    });
    return;
  }

  // Dev fallback — log only, never throws.
  console.log(`[SMS dev] OTP for ${phone}: ${code}`);
}

module.exports = { sendOTP };
