const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { sendMail } = require('./mailer');
const { sendSms } = require('./sms');
const { sendPush } = require('./push');

/**
 * Push a notification to one user over the selected channels.
 * channels: { inapp?: bool, email?: bool, sms?: bool, push?: bool }
 * (in-app and push are on by default — push silently no-ops for users with
 * no registered browser subscription, so it's safe to always attempt.)
 */
async function notifyUser(user, { title, message, meta = {}, channels = { inapp: true } }) {
  const results = { inapp: false, email: false, sms: false, push: false };

  if (channels.inapp !== false) {
    await db.put('notifications', {
      id: uuid(),
      userId: user.id,
      title,
      message,
      meta,
      read: false,
      createdAt: new Date().toISOString(),
    });
    results.inapp = true;
  }
  if (channels.email && user.email) {
    const r = await sendMail({ to: user.email, subject: title, text: message });
    results.email = !!r.sent;
  }
  if (channels.sms && user.phone) {
    const r = await sendSms(user.phone, `${title} — ${message}`);
    results.sms = !!r.sent;
  }
  if (channels.push !== false) {
    const r = await sendPush(user.id, { title, message, url: meta.orderId ? `/orders` : '/notifications' });
    results.push = r.sent > 0;
  }
  return results;
}

/**
 * Broadcast to every customer (admin excluded), log the campaign, and return
 * per-channel delivery counts.
 */
async function broadcast({ title, message, channels, meta = {} }) {
  const users = (await db.list('users')).filter((u) => u.role !== 'admin');
  const counts = { audience: users.length, inapp: 0, email: 0, sms: 0, push: 0 };

  for (const user of users) {
    const r = await notifyUser(user, { title, message, meta, channels });
    if (r.inapp) counts.inapp += 1;
    if (r.email) counts.email += 1;
    if (r.sms) counts.sms += 1;
    if (r.push) counts.push += 1;
  }

  await db.put('notification-logs', {
    id: uuid(),
    title,
    message,
    channels,
    counts,
    createdAt: new Date().toISOString(),
  });
  return counts;
}

module.exports = { notifyUser, broadcast };
