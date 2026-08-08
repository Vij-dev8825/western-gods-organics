const db = require('../data/db');
const { notifyUser } = require('./notify');

const SITE_URL = process.env.SITE_URL || 'https://westerngodsorganic.com';

// Sent once, a few hours after delivery — long enough that the customer has
// actually opened the package, short enough that unboxing is still fresh.
// The upper bound is generous so a missed hourly tick (server restart, a
// slow run) still catches the order on the next pass, without reaching back
// far enough to nudge someone about a package they opened days ago.
const MIN_HOURS_AFTER_DELIVERY = 2;
const MAX_HOURS_AFTER_DELIVERY = 26;
const HOUR_MS = 60 * 60 * 1000;

/** Piggybacks on the same hourly setInterval cadence as processAbandonedCarts/
 * processDueSubscriptions (see server.js) — no separate timer needed.
 * Sends at most one nudge per order, recorded on the order itself so a
 * restart or a slow tick can't double-send. */
async function processDeliveryUnboxingNudges() {
  const [orders, users] = await Promise.all([db.list('orders'), db.list('users')]);
  const usersById = new Map(users.map((u) => [u.id, u]));
  const now = Date.now();
  const results = [];

  for (const order of orders) {
    if (!order.deliveredAt || order.unboxingNudgeSentAt) continue;
    const hoursSince = (now - new Date(order.deliveredAt).getTime()) / HOUR_MS;
    if (hoursSince < MIN_HOURS_AFTER_DELIVERY || hoursSince > MAX_HOURS_AFTER_DELIVERY) continue;

    const user = usersById.get(order.userId);
    if (!user) continue;

    try {
      const [firstItem, ...rest] = order.items;
      const itemLabel = firstItem ? `${firstItem.name}${rest.length ? ` (+${rest.length} more)` : ''}` : 'your order';
      await notifyUser(user, {
        title: 'Hope it arrived well!',
        message: `Your ${itemLabel} should be with you by now. For tips on getting the most out of it, check our usage guides: ${SITE_URL}/guides`,
        meta: { orderId: order.id },
        channels: { inapp: true, whatsapp: true },
      });

      order.unboxingNudgeSentAt = new Date(now).toISOString();
      await db.put('orders', order);
      results.push({ orderId: order.id, nudged: true });
    } catch (err) {
      results.push({ orderId: order.id, error: err.message });
    }
  }

  return results;
}

module.exports = { processDeliveryUnboxingNudges };
