/**
 * WhatsApp broadcast, gated to a 24-hour reply window (see
 * utils/whatsappBaileys.js's recordInboundMessage) — only customers who've
 * messaged the business themselves in the last 24 hours are eligible, same
 * rule the official WhatsApp Business API enforces for its own "customer
 * service window". Keeping to it here, on Baileys (an unofficial client),
 * means outbound traffic still looks like normal reply activity rather than
 * a marketing blast — the thing most likely to get an unofficial number
 * banned, taking existing OTP/order-notification delivery down with it.
 */
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { sendWhatsApp } = require('./whatsapp');

const WINDOW_MS = 24 * 60 * 60 * 1000;
// Sent one at a time with a pause between each, never in parallel — even
// among eligible recipients, a sudden burst of outbound messages is itself
// a pattern WhatsApp's spam detection can flag, independent of who receives it.
const SEND_DELAY_MS = 2000;
const MAX_RECIPIENTS_PER_CAMPAIGN = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Everyone who's messaged us in the last 24 hours — the pool an admin can
 * pick a broadcast's recipients from, newest contact first. */
async function getEligibleRecipients() {
  const cutoff = Date.now() - WINDOW_MS;
  const inbox = await db.list('whatsapp-inbox');
  return inbox
    .filter((e) => new Date(e.lastInboundAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.lastInboundAt) - new Date(a.lastInboundAt));
}

/** Sends `message` to each of `phones`, one at a time with a pause between
 * sends — but only to numbers still inside the reply window right now (
 * re-checked here, not just trusted from whatever the admin saw when the
 * page loaded, since a window can close mid-review). Always logs the
 * campaign, including anyone silently dropped for having gone stale. */
async function sendBroadcast(phones, message) {
  const eligible = await getEligibleRecipients();
  const eligiblePhones = new Set(eligible.map((e) => e.phone));
  const requested = [...new Set(phones)].slice(0, MAX_RECIPIENTS_PER_CAMPAIGN);

  const results = [];
  for (const phone of requested) {
    if (!eligiblePhones.has(phone)) {
      results.push({ phone, sent: false, reason: 'outside-reply-window' });
      continue;
    }
    const r = await sendWhatsApp(phone, message);
    results.push({ phone, sent: !!r.sent, reason: r.sent ? undefined : r.reason || r.error });
    await sleep(SEND_DELAY_MS);
  }

  const log = {
    id: uuid(),
    message,
    requestedCount: phones.length,
    sentCount: results.filter((r) => r.sent).length,
    skippedCount: results.filter((r) => !r.sent).length,
    results,
    createdAt: new Date().toISOString(),
  };
  await db.put('whatsapp-broadcast-log', log);
  return log;
}

async function getBroadcastLog() {
  return (await db.list('whatsapp-broadcast-log')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  WINDOW_MS,
  MAX_RECIPIENTS_PER_CAMPAIGN,
  getEligibleRecipients,
  sendBroadcast,
  getBroadcastLog,
};
