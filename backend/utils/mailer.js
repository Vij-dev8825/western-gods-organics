const nodemailer = require('nodemailer');

const RESEND_API_KEY = process.env.RESEND_API_KEY;

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
    // OTP…" button with no error ever shown). Also relevant since many PaaS
    // hosts (Render included) block outbound SMTP ports entirely — this at
    // least fails fast instead of hanging when that happens.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
}

// Resend's sandbox sender works immediately with no domain setup, but can
// only deliver to the Resend account's own verified address until a real
// domain is verified (resend.com/domains) — swap MAIL_FROM to an address on
// that domain once verified, for both better deliverability and to unlock
// sending to arbitrary recipients.
const FROM = process.env.MAIL_FROM
  || (RESEND_API_KEY ? 'Western Gods Organics <onboarding@resend.dev>' : 'Western Gods Organics <westerngodsorganic@gmail.com>');

/**
 * Sends an email. Tries Resend's HTTP API first when configured (works over
 * standard HTTPS, so it isn't affected by hosts that block outbound SMTP
 * ports), falling back to SMTP, then to a console log when neither is set up
 * — so the whole notification flow is testable locally with no email account.
 */
/** attachments: [{ filename, content: Buffer, contentType }] — the two
 *  providers want the same file in different shapes (Resend takes base64 in
 *  JSON, nodemailer takes the Buffer), so callers pass a Buffer and this
 *  translates. */
async function sendMail({ to, subject, text, html, attachments }) {
  if (!to) return { sent: false, reason: 'no-address' };
  const files = (attachments || []).filter((a) => a && a.content);

  if (RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM, to, subject, text, html,
          ...(files.length
            ? { attachments: files.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64') })) }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Resend ${res.status}`);
      return { sent: true, provider: 'resend' };
    } catch (err) {
      console.error('[MAIL:resend:error]', err.message);
      // Falls through to SMTP/dev-log below.
    }
  }

  if (!transporter) {
    const withFiles = files.length ? ` [+${files.map((a) => a.filename).join(', ')}]` : '';
    console.log(`[MAIL:dev] to=${to} | ${subject}${withFiles} | ${String(text || '').slice(0, 120)}`);
    return { sent: true, dev: true };
  }
  try {
    await transporter.sendMail({
      from: FROM, to, subject, text, html,
      ...(files.length
        ? { attachments: files.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) }
        : {}),
    });
    return { sent: true, provider: 'smtp' };
  } catch (err) {
    console.error('[MAIL:error]', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendMail };
