/**
 * Browser/OS push notifications via the standard Web Push protocol —
 * self-generated VAPID keys, no third-party push service account needed.
 */
const webpush = require('web-push');
const db = require('../data/db');

let configured = false;

function isConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hello@yamunaorganics.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

/** Sends a push notification to every subscription this user has registered
 * (e.g. multiple browsers/devices), dropping any that the push service
 * reports as expired/invalid (410/404). */
async function sendPush(userId, { title, message, url }) {
  if (!isConfigured()) return { sent: 0 };
  ensureConfigured();

  const subs = (await db.list('push-subscriptions')).filter((s) => s.userId === userId);
  const payload = JSON.stringify({ title, body: message, url: url || '/' });
  let sent = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.remove('push-subscriptions', sub.id);
      }
    }
  }
  return { sent };
}

module.exports = { isConfigured, sendPush };
