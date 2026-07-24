const db = require('../data/db');
const { buildOrderItems, createOrderRecord } = require('./orderBuilder');

const DISCOUNT_PERCENT = 10;
const MIN_FREQUENCY_DAYS = 7;
const MAX_FREQUENCY_DAYS = 180;

function isValidFrequencyDays(days) {
  return Number.isInteger(days) && days >= MIN_FREQUENCY_DAYS && days <= MAX_FREQUENCY_DAYS;
}

function computeNextDate(fromIso, days) {
  const d = new Date(fromIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Places a renewal order for every active subscription whose nextOrderDate
 * has passed, applying the standard subscription discount. Runs on a plain
 * setInterval from server.js (no worker process on Render's free plan) and
 * is also exposed via an admin-triggered endpoint as a manual fallback. */
async function processDueSubscriptions() {
  const subs = await db.list('subscriptions');
  const now = new Date();
  const results = [];

  for (const sub of subs) {
    if (sub.status !== 'active') continue;
    if (new Date(sub.nextOrderDate) > now) continue;

    try {
      const { orderItems, subtotal, shipping, stockError } = await buildOrderItems(
        [{ productId: sub.productId, size: sub.size, quantity: sub.quantity }],
        null,
        sub.address?.country,
        sub.userId
      );
      if (!orderItems[0]?.price || stockError) {
        results.push({ subscriptionId: sub.id, skipped: true, reason: stockError || 'Product or size no longer available' });
        continue;
      }

      const discount = Math.round(subtotal * (DISCOUNT_PERCENT / 100));
      const total = subtotal + shipping - discount;
      const order = await createOrderRecord({
        userId: sub.userId,
        orderItems,
        address: sub.address,
        total,
        discount,
        couponCode: `SUBSCRIBE${DISCOUNT_PERCENT}`,
        paymentMethod: 'cod',
        subscriptionId: sub.id,
      });

      sub.lastOrderId = order.id;
      sub.nextOrderDate = computeNextDate(sub.nextOrderDate, sub.frequencyDays);
      await db.put('subscriptions', sub);
      results.push({ subscriptionId: sub.id, orderId: order.id });
    } catch (err) {
      results.push({ subscriptionId: sub.id, error: err.message });
    }
  }

  return results;
}

module.exports = {
  DISCOUNT_PERCENT,
  MIN_FREQUENCY_DAYS,
  MAX_FREQUENCY_DAYS,
  isValidFrequencyDays,
  computeNextDate,
  processDueSubscriptions,
};
