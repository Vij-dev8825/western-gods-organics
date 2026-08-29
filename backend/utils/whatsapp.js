/**
 * WhatsApp order-update and OTP messages — see ./whatsappBaileys.js for how
 * the actual connection is managed. This wrapper just keeps the exported
 * shape callers (auth.js, notify.js) already expect.
 */
const { sendWhatsAppMessage, sendWhatsAppDocument, sendWhatsAppImage } = require('./whatsappBaileys');

async function sendWhatsApp(phone, message) {
  if (!phone) return { sent: false, reason: 'no-phone' };
  return sendWhatsAppMessage(phone, message);
}

/** file: { buffer, fileName, mimetype?, caption? } */
async function sendWhatsAppFile(phone, file) {
  if (!phone) return { sent: false, reason: 'no-phone' };
  return sendWhatsAppDocument(phone, file);
}

/** photo: { url, caption? } — a public URL, not a buffer; see sendWhatsAppImage. */
async function sendWhatsAppPhoto(phone, photo) {
  if (!phone) return { sent: false, reason: 'no-phone' };
  return sendWhatsAppImage(phone, photo);
}

module.exports = { sendWhatsApp, sendWhatsAppFile, sendWhatsAppPhoto };
