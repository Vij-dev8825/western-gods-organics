const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { sendMail } = require('./mailer');
const { sendSms } = require('./sms');
const { sendWhatsApp } = require('./whatsapp');
const { sendPush, sendPushToAnonymous } = require('./push');

const SITE_URL = process.env.SITE_URL || 'https://westerngodsorganic.com';

/** Resolves a stored image path (e.g. /api/media/xyz or /uploads/xyz) to an
 * absolute URL — email clients and push payloads can't load relative paths. */
function absoluteImageUrl(image) {
  if (!image) return null;
  return /^https?:\/\//.test(image) ? image : `${SITE_URL}${image}`;
}

/** Where clicking the notification (push toast or in-app list item) should
 * land — product page takes priority over the order it may also reference. */
function notificationUrl(meta) {
  if (meta.productId) return `/product/${meta.productId}`;
  if (meta.orderId) return '/orders';
  if (meta.cart) return '/cart';
  return '/notifications';
}

/**
 * Push a notification to one user over the selected channels.
 * channels: { inapp?: bool, email?: bool, sms?: bool, whatsapp?: bool, push?: bool }
 * (in-app and push are on by default — push silently no-ops for users with
 * no registered browser subscription, so it's safe to always attempt.)
 */
async function notifyUser(user, { title, message, image, meta = {}, channels = { inapp: true } }) {
  const results = { inapp: false, email: false, sms: false, whatsapp: false, push: false };
  const imageUrl = absoluteImageUrl(image);

  if (channels.inapp !== false) {
    await db.put('notifications', {
      id: uuid(),
      userId: user.id,
      title,
      message,
      image: image || null,
      meta,
      read: false,
      createdAt: new Date().toISOString(),
    });
    results.inapp = true;
  }
  if (channels.email && user.email) {
    const html = imageUrl
      ? `<img src="${imageUrl}" alt="" style="max-width:100%;border-radius:8px;margin-bottom:12px;" /><p>${message}</p>`
      : undefined;
    const r = await sendMail({ to: user.email, subject: title, text: message, html });
    results.email = !!r.sent;
  }
  if (channels.sms && user.phone) {
    const r = await sendSms(user.phone, `${title} — ${message}`);
    results.sms = !!r.sent;
  }
  if (channels.whatsapp && user.phone) {
    const r = await sendWhatsApp(user.phone, `*${title}*\n${message}`);
    results.whatsapp = !!r.sent;
  }
  if (channels.push !== false) {
    const r = await sendPush(user.id, {
      title,
      message,
      image: imageUrl,
      url: notificationUrl(meta),
    });
    results.push = r.sent > 0;
  }
  return results;
}

/**
 * Broadcast to every customer (admin excluded), log the campaign, and return
 * per-channel delivery counts.
 */
async function broadcast({ title, message, image, channels, meta = {} }) {
  const users = (await db.list('users')).filter((u) => u.role !== 'admin');
  const counts = { audience: users.length, inapp: 0, email: 0, sms: 0, whatsapp: 0, push: 0 };

  for (const user of users) {
    const r = await notifyUser(user, { title, message, image, meta, channels });
    if (r.inapp) counts.inapp += 1;
    if (r.email) counts.email += 1;
    if (r.sms) counts.sms += 1;
    if (r.whatsapp) counts.whatsapp += 1;
    if (r.push) counts.push += 1;
  }

  // Anonymous browser-notification subscribers (opted in without an
  // account) aren't customer records, so they only get the push channel.
  if (channels?.push !== false) {
    const imageUrl = absoluteImageUrl(image);
    const { sent } = await sendPushToAnonymous({ title, message, image: imageUrl, url: '/' });
    counts.push += sent;
    counts.audience += (await db.list('push-subscriptions')).filter((s) => s.userId === null).length;
  }

  await db.put('notification-logs', {
    id: uuid(),
    title,
    message,
    image: image || null,
    meta,
    channels,
    counts,
    createdAt: new Date().toISOString(),
  });
  return counts;
}

module.exports = { notifyUser, broadcast };
