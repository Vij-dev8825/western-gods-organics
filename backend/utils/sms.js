/**
 * SMS provider chain, checked in order for each call:
 *
 *  - sendOtpSms(phone, otp) — for login OTPs specifically. A phone starting
 *    with "+" (international, see auth.js) always skips straight to Twilio —
 *    Fast2SMS and MSG91 only deliver to Indian numbers. Otherwise:
 *    1. Fast2SMS OTP route (FAST2SMS_API_KEY) — free-credit Indian provider,
 *       no DLT template needed for their built-in numeric-OTP route.
 *    2. MSG91's dedicated OTP API (MSG91_AUTH_KEY) — matches an OTP-category
 *       template using the "##OTP##" placeholder, created via MSG91
 *       dashboard → OTP → SendOTP → Templates.
 *    3. Twilio.
 *    4. Console log (dev).
 *
 *  - sendSms(phone, message) — for free-form text (admin broadcast
 *    notifications). Domestic-only for now (India phone numbers).
 *    1. Fast2SMS Quick SMS route (best-effort — Indian carriers increasingly
 *       require DLT-registered templates for non-OTP text, so this may be
 *       rejected without one).
 *    2. Twilio (sends free-form text with no template).
 *    3. Console log (dev). MSG91's OTP API can't send arbitrary text, so
 *       MSG91-only config logs to the console here.
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

async function sendOtpSms(phone, otp) {
  if (!phone) return { sent: false, reason: 'no-phone' };

  // A leading "+" marks an already-fully-qualified international number
  // (see auth.js's isValidPhone) — Fast2SMS and MSG91 only deliver to Indian
  // numbers, so route straight to Twilio (the only configured provider that
  // can actually reach international numbers) using the number as-is,
  // instead of the domestic path's hardcoded +91 prefix.
  if (phone.startsWith('+')) {
    return sendViaTwilioOrLog(phone, `${otp} is your Western Gods Organics OTP. Do not share this code.`, { international: true });
  }

  if (process.env.FAST2SMS_API_KEY) {
    try {
      await fast2SmsRequest({ route: 'otp', variables_values: otp, numbers: phone });
      return { sent: true, provider: 'fast2sms' };
    } catch (err) {
      console.error('[SMS:fast2sms:error]', err.message);
      return { sent: false, error: err.message };
    }
  }

  if (process.env.MSG91_AUTH_KEY) {
    try {
      const params = new URLSearchParams({
        template_id: process.env.MSG91_TEMPLATE_ID,
        mobile: `91${phone}`,
        authkey: process.env.MSG91_AUTH_KEY,
        otp,
      });
      const res = await fetch(`https://api.msg91.com/api/v5/otp?${params.toString()}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.type === 'error') throw new Error(data.message || `MSG91 ${res.status}`);
      return { sent: true, provider: 'msg91' };
    } catch (err) {
      console.error('[SMS:msg91:error]', err.message);
      return { sent: false, error: err.message };
    }
  }

  return sendViaTwilioOrLog(phone, `${otp} is your Western Gods Organics OTP. Do not share this code.`);
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

async function sendViaTwilioOrLog(phone, message, { international = false } = {}) {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const body = new URLSearchParams({
        To: international ? phone : `+91${phone}`,
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

module.exports = { sendOtpSms, sendSms };
