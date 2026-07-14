/**
 * Two SMS paths, since MSG91 treats OTPs and general text as different APIs:
 *
 *  - sendOtpSms(phone, otp) — for login OTPs specifically.
 *    Uses MSG91's dedicated OTP API when MSG91_AUTH_KEY is set (matches an
 *    OTP-category template using the "##OTP##" placeholder, created via
 *    MSG91 dashboard → OTP → SendOTP → Templates). Falls back to Twilio,
 *    then to a console log in dev mode.
 *
 *  - sendSms(phone, message) — for free-form text (admin broadcast
 *    notifications). MSG91's OTP API can't send arbitrary text, so this
 *    only actually delivers via Twilio; with MSG91-only config it logs to
 *    the console. A separate MSG91 Flow API + promotional DLT template
 *    would be needed to support this over MSG91, which is out of scope
 *    for now (see routes/auth.js for the OTP path, which is the one in use).
 */

async function sendOtpSms(phone, otp) {
  if (!phone) return { sent: false, reason: 'no-phone' };

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

  return sendViaTwilioOrLog(phone, `${otp} is your Yamuna Organics OTP. Do not share this code.`);
}

async function sendSms(phone, message) {
  if (!phone) return { sent: false, reason: 'no-phone' };
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

module.exports = { sendOtpSms, sendSms };
