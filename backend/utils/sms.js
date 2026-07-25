/**
 * SMS provider chain for free-form text (admin broadcast notifications —
 * login OTPs now go through Firebase phone auth instead, see
 * routes/auth.js's firebase-login route). Domestic-only for now (India
 * phone numbers), checked in order:
 *
 *  1. Fast2SMS Quick SMS route (best-effort — Indian carriers increasingly
 *     require DLT-registered templates for non-OTP text, so this may be
 *     rejected without one).
 *  2. Twilio (sends free-form text with no template).
 *  3. Console log (dev).
 */

async function fast2SmsRequest(params) {
  const query = new URLSearchParams({
    authorization: process.env.FAST2SMS_API_KEY,
    flash: '0',
    ...params,
  });
  const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?${query.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.return !== true) {
    throw new Error((Array.isArray(data.message) ? data.message[0] : data.message) || `Fast2SMS ${res.status}`);
  }
  return data;
}

async function sendSms(phone, message) {
  if (!phone) return { sent: false, reason: 'no-phone' };

  if (process.env.FAST2SMS_API_KEY) {
    try {
      await fast2SmsRequest({ route: 'q', message, numbers: phone });
      return { sent: true, provider: 'fast2sms' };
    } catch (err) {
      console.error('[SMS:fast2sms:error]', err.message);
      // Falls through to Twilio/log — Fast2SMS's DLT-free quick route can
      // reject free-form text depending on carrier/content.
    }
  }

  return sendViaTwilioOrLog(phone, message);
}

async function sendViaTwilioOrLog(phone, message) {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const body = new URLSearchParams({
        To: `+91${phone}`,
        From: process.env.TWILIO_FROM,
        Body: message,
      });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      if (!res.ok) throw new Error(`Twilio ${res.status}`);
      return { sent: true, provider: 'twilio' };
    } catch (err) {
      console.error('[SMS:twilio:error]', err.message);
      return { sent: false, error: err.message };
    }
  }

  console.log(`[SMS:dev] to=${phone} | ${message}`);
  return { sent: true, dev: true };
}

module.exports = { sendSms };
