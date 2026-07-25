const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: (parseInt(process.env.SMTP_PORT, 10) || 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    // Without these, a misconfigured/unreachable SMTP host hangs the whole
    // request indefinitely instead of failing fast (e.g. a stuck "Sending
    // OTP…" button with no error ever shown).
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
}

const FROM = process.env.MAIL_FROM || 'Western Gods Organics <westerngodsorganic@gmail.com>';

/**
 * Sends an email. Without SMTP_* env vars it logs instead of sending, so the
 * whole notification flow is testable locally with no email account.
 */
async function sendMail({ to, subject, text, html }) {
  if (!to) return { sent: false, reason: 'no-address' };
  if (!transporter) {
    console.log(`[MAIL:dev] to=${to} | ${subject} | ${String(text || '').slice(0, 120)}`);
    return { sent: true, dev: true };
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error('[MAIL:error]', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendMail };
