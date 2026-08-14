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
const db = require('../data/db');

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

// Tracks the last time each phone number messaged us, keyed by phone (one
// upsert per number, not an append-only log — only the recency matters).
// This is what utils/whatsappBroadcast.js's 24-hour reply window reads to
// decide who's safe to message: mirrors the official WhatsApp Business
// API's own "24-hour customer service window" rule, so a marketing send
// looks like organic reply traffic even though this runs on Baileys (an
// unofficial client) rather than the real Business API.
async function recordInboundMessage(phone, text) {
  const user = (await db.list('users')).find((u) => u.phone === phone);
  await db.put('whatsapp-inbox', {
    id: phone,
    phone,
    userId: user?.id || null,
    name: user?.name || null,
    lastMessage: text.slice(0, 300),
    lastInboundAt: new Date().toISOString(),
  });
}

async function handleIncomingMessages({ messages, type }) {
  if (type !== 'notify') return; // 'append' etc. is historical sync, not a new message
  // Required lazily (not at module top-level): whatsappOrdering.js requires
  // orderBuilder.js, which itself requires this file's own module (whatsapp.js
  // -> whatsappBaileys.js) — an eager top-level require here would resolve
  // mid-cycle and leave OTHER modules (notify.js, orderBuilder.js) holding a
  // permanently-undefined sendWhatsApp. By startup's end every module has
  // finished loading, so a require() here just hits Node's module cache.
  const whatsappOrdering = require('./whatsappOrdering');
  for (const msg of messages) {
    try {
      const jid = msg.key?.remoteJid;
      if (!jid || msg.key?.fromMe || jid.endsWith('@g.us')) continue; // skip our own sends and group chats
      const text = extractText(msg.message);
      if (!text) continue;

      const phone = jidToPhone(jid);
      await recordInboundMessage(phone, text);
      const reply = await whatsappOrdering.handleIncomingMessage(phone, text);
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

/** Bare 10-digit numbers are Indian; anything already in +country form keeps
 *  the country it was given. Shared by both senders so a document and a text
 *  can never disagree about who they are going to. */
const toJid = (phone) => `${phone.startsWith('+') ? phone.slice(1) : `91${phone}`}@s.whatsapp.net`;

async function sendWhatsAppMessage(phone, message) {
  if (!phone) return { sent: false, reason: 'no-phone' };
  if (!sock || state !== 'open') {
    console.log(`[whatsapp:not-connected] to=${phone} | ${message}`);
    return { sent: false, reason: 'not-connected' };
  }
  try {
    await sock.sendMessage(toJid(phone), { text: message });
    return { sent: true, provider: 'baileys' };
  } catch (err) {
    console.error('[whatsapp:baileys:error]', err.message);
    return { sent: false, error: err.message };
  }
}

/**
 * Sends a file — an invoice PDF, in practice.
 *
 * Deliberately one message carrying both the document and its caption, rather
 * than a text followed by an attachment: two messages can arrive out of order,
 * and a PDF landing with no explanation looks like something to be wary of.
 */
async function sendWhatsAppDocument(phone, { buffer, fileName, mimetype = 'application/pdf', caption }) {
  if (!phone) return { sent: false, reason: 'no-phone' };
  if (!buffer?.length) return { sent: false, reason: 'no-file' };
  if (!sock || state !== 'open') {
    console.log(`[whatsapp:not-connected] to=${phone} | document ${fileName} (${buffer.length} bytes)`);
    return { sent: false, reason: 'not-connected' };
  }
  try {
    await sock.sendMessage(toJid(phone), { document: buffer, fileName, mimetype, caption });
    return { sent: true, provider: 'baileys' };
  } catch (err) {
    console.error('[whatsapp:baileys:document:error]', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { init, getStatus, resetSession, sendWhatsAppMessage, sendWhatsAppDocument };
