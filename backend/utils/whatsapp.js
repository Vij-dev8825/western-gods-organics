/**
 * WhatsApp order-update and OTP messages — see ./whatsappBaileys.js for how
 * the actual connection is managed. This wrapper just keeps the exported
 * shape callers (auth.js, notify.js) already expect.
 */
const { sendWhatsAppMessage, sendWhatsAppDocument } = require('./whatsappBaileys');

async function sendWhatsApp(phone, message) {
  if (!phone) return { sent: false, reason: 'no-phone' };
  return sendWhatsAppMessage(phone, message);
}

/** file: { buffer, fileName, mimetype?, caption? } */
async function sendWhatsAppFile(phone, file) {
  if (!phone) return { sent: false, reason: 'no-phone' };
  return sendWhatsAppDocument(phone, file);
}

module.exports = { sendWhatsApp, sendWhatsAppFile };
