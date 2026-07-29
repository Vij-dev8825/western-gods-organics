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
const whatsappOrdering = require('./whatsappOrdering');

const AUTH_DIR = path.join(__dirname, '..', 'whatsapp-auth');

let sock = null;
let state = 'connecting'; // 'connecting' | 'qr' | 'open' | 'close'
let qrDataUrl = null;
let startPromise = null;

// Converts a Baileys JID (e.g. "919999999999@s.whatsapp.net" or with a
// ":deviceId" suffix) back to this app's own phone format — the reverse of
// sendWhatsAppMessage's own `91${phone}` convention below, so it round-trips
// with however a customer's phone is actually stored on their account.
function jidToPhone(jid) {
  const digits = jid.split('@')[0].split(':')[0];
  if (digits.startsWith('91') && digits.length === 12) return digits.slice(2);
  return `+${digits}`;
}

function extractText(message) {
  return message?.conversation || message?.extendedTextMessage?.text || '';
}

async function handleIncomingMessages({ messages, type }) {
  if (type !== 'notify') return; // 'append' etc. is historical sync, not a new message
  for (const msg of messages) {
    try {
      const jid = msg.key?.remoteJid;
      if (!jid || msg.key?.fromMe || jid.endsWith('@g.us')) continue; // skip our own sends and group chats
      const text = extractText(msg.message);
      if (!text) continue;

      const reply = await whatsappOrdering.handleIncomingMessage(jidToPhone(jid), text);
      if (reply) await sock.sendMessage(jid, { text: reply });
    } catch (err) {
      console.error('[whatsapp:ordering] error handling message', err.message);
    }
  }
}

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
  sock.ev.on('messages.upsert', handleIncomingMessages);

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
