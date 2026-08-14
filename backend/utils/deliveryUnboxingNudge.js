const db = require('../data/db');
const { notifyUser } = require('./notify');
const { ensureFeedbackToken } = require('./orderFeedback');

const SITE_URL = process.env.SITE_URL || 'https://westerngodsorganic.com';

// Sent once, a few hours after delivery — long enough that the customer has
// actually opened the package, short enough that unboxing is still fresh.
// The upper bound is generous so a missed hourly tick (server restart, a
// slow run) still catches the order on the next pass, without reaching back
// far enough to nudge someone about a package they opened days ago.
const MIN_HOURS_AFTER_DELIVERY = 2;
const MAX_HOURS_AFTER_DELIVERY = 26;
const HOUR_MS = 60 * 60 * 1000;

// A returned or cancelled order has already been discussed with the shop.
// Asking how it went reads as not having been listening.
const EXCLUDED_STATUSES = new Set(['cancelled', 'returned', 'refunded']);

/**
 * Asks how it went, the day after it arrived.
 *
 * This message used to point at the usage guides and ask nothing, which meant
 * the shop's only channel back from a customer was a public review a week
 * later. A bottle that arrived leaking had nowhere to be reported except the
 * product page. Now the same message carries a one-tap form: no login, no app,
 * answerable from the WhatsApp thread it arrives in.
 *
 * The guides link stays, because the honest reason to open this message is
 * still that the oil is new and people want to know what to do with it.
 *
 * Piggybacks on the same hourly setInterval cadence as processAbandonedCarts/
 * processDueSubscriptions (see server.js) — no separate timer needed.
 * Sends at most one nudge per order, recorded on the order itself so a
 * restart or a slow tick can't double-send.
 */
async function processDeliveryUnboxingNudges() {
  const [orders, users] = await Promise.all([db.list('orders'), db.list('users')]);
  const usersById = new Map(users.map((u) => [u.id, u]));
  const now = Date.now();
  const results = [];

  for (const order of orders) {
    if (!order.deliveredAt || order.unboxingNudgeSentAt) continue;
    if (EXCLUDED_STATUSES.has(order.status)) continue;
    const hoursSince = (now - new Date(order.deliveredAt).getTime()) / HOUR_MS;
    if (hoursSince < MIN_HOURS_AFTER_DELIVERY || hoursSince > MAX_HOURS_AFTER_DELIVERY) continue;

    const user = usersById.get(order.userId);
    if (!user) continue;

    try {
      const [firstItem, ...rest] = order.items || [];
      const itemLabel = firstItem ? `${firstItem.name}${rest.length ? ` (+${rest.length} more)` : ''}` : 'your order';
      const token = await ensureFeedbackToken(order);

      await notifyUser(user, {
        title: 'How did we do?',
        message:
          `Your ${itemLabel} should be with you by now. Did it arrive in good condition? ` +
          `One tap tells us, and it comes straight to the mill — not a public page: ` +
          `${SITE_URL}/feedback/${token}\n\n` +
          `If you'd like tips on using it: ${SITE_URL}/guides`,
        meta: { orderId: order.id, url: `/feedback/${token}` },
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
