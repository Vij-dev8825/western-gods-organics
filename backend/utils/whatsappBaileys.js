/**
 * WhatsApp messaging via a real linked WhatsApp account (the same protocol
 * whatsapp.com/web uses), instead of Twilio's WhatsApp Sandbox — the Sandbox
 * only delivers to numbers that have manually "joined" it first, which made
 * it unusable for real customers (see utils/whatsapp.js history).
 *
 * Pairing: on first run (or after a real logout), a QR code is generated —
 * see GET /api/admin/whatsapp in routes/admin.js. Scan it from WhatsApp on
 * the phone you want this store to send from (Settings → Linked Devices).
 * Credentials persist in ./whatsapp-auth (gitignored) so re-deploys don't
 * require re-pairing — only an actual remote logout does.
 *
 * Baileys ships as ESM-only; this file stays CommonJS like the rest of the
 * backend and loads it via dynamic import().
 */
const path = require('path');
const fs = require('fs');

const AUTH_DIR = path.join(__dirname, '..', 'whatsapp-auth');

let sock = null;
let state = 'connecting'; // 'connecting' | 'qr' | 'open' | 'close'
let qrDataUrl = null;
let startPromise = null;

async function connect() {
  const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = await import(
    '@whiskeysockets/baileys'
  );
  const { default: QRCode } = await import('qrcode');
  const pino = require('pino');

  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: authState,
    logger: pino({ level: 'error' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    if (update.qr) {
      qrDataUrl = await QRCode.toDataURL(update.qr);
      state = 'qr';
    }
    if (update.connection === 'open') {
      state = 'open';
      qrDataUrl = null;
      console.log('[whatsapp] connected');
    }
    if (update.connection === 'close') {
      state = 'close';
      const statusCode = update.lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.error(`[whatsapp] connection closed (code ${statusCode})${loggedOut ? ' — logged out, re-pairing' : ' — reconnecting'}`);
      if (loggedOut) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      }
      connect().catch((err) => console.error('[whatsapp] reconnect failed', err));
    }
  });
}

/** Called once at server startup. Safe to call again to force a fresh pairing. */
function init() {
  if (!startPromise) {
    startPromise = connect().catch((err) => console.error('[whatsapp] init failed', err));
  }
  return startPromise;
}

function getStatus() {
  return { state, qr: qrDataUrl };
}

/** Wipes the current session and starts over — used when re-pairing to a different number. */
async function resetSession() {
  try {
    if (sock) sock.end(undefined);
  } catch {
    // socket may already be closed
  }
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  state = 'connecting';
  qrDataUrl = null;
  startPromise = null;
  return init();
}

async function sendWhatsAppMessage(phone, message) {
  if (!phone) return { sent: false, reason: 'no-phone' };
  if (!sock || state !== 'open') {
    console.log(`[whatsapp:not-connected] to=${phone} | ${message}`);
    return { sent: false, reason: 'not-connected' };
  }
  try {
    const digits = phone.startsWith('+') ? phone.slice(1) : `91${phone}`;
    await sock.sendMessage(`${digits}@s.whatsapp.net`, { text: message });
    return { sent: true, provider: 'baileys' };
  } catch (err) {
    console.error('[whatsapp:baileys:error]', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { init, getStatus, resetSession, sendWhatsAppMessage };
