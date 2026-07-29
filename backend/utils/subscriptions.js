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

/** Computes what a subscription's next renewal should cost right now (live
 * product price − subscription discount + shipping) — shared by the COD
 * renewal path, UPI Autopay enrollment (which locks this amount into a
 * Razorpay plan), and the webhook-triggered autopay renewal below. */
async function computeRenewalAmount(sub) {
  const { orderItems, subtotal, shipping, stockError } = await buildOrderItems(
    [{ productId: sub.productId, size: sub.size, quantity: sub.quantity }],
    null,
    sub.address?.country,
    sub.userId
  );
  if (!orderItems[0]?.price || stockError) {
    return { error: stockError || 'Product or size no longer available' };
  }
  const discount = Math.round(subtotal * (DISCOUNT_PERCENT / 100));
  const total = subtotal + shipping - discount;
  return { orderItems, subtotal, shipping, discount, total };
}

/** Places one renewal order for a subscription and advances its
 * nextOrderDate — shared by the COD cron path (processDueSubscriptions) and
 * the UPI Autopay webhook path (routes/webhooks.js), which only differ in
 * paymentMethod/payment. */
async function renewSubscription(sub, { paymentMethod, payment }) {
  const computed = await computeRenewalAmount(sub);
  if (computed.error) return { subscriptionId: sub.id, skipped: true, reason: computed.error };

  const order = await createOrderRecord({
    userId: sub.userId,
    orderItems: computed.orderItems,
    address: sub.address,
    total: computed.total,
    discount: computed.discount,
    couponCode: `SUBSCRIBE${DISCOUNT_PERCENT}`,
    paymentMethod,
    payment,
    subscriptionId: sub.id,
  });

  sub.lastOrderId = order.id;
  sub.nextOrderDate = computeNextDate(sub.nextOrderDate, sub.frequencyDays);
  await db.put('subscriptions', sub);
  return { subscriptionId: sub.id, orderId: order.id };
}

/** Places a renewal order for every active subscription whose nextOrderDate
 * has passed, applying the standard subscription discount. Runs on a plain
 * setInterval from server.js (no worker process on Render's free plan) and
 * is also exposed via an admin-triggered endpoint as a manual fallback.
 * Autopay-enrolled subscriptions are skipped here — Razorpay charges their
 * UPI mandate directly and notifies routes/webhooks.js instead. */
async function processDueSubscriptions() {
  const subs = await db.list('subscriptions');
  const now = new Date();
  const results = [];

  for (const sub of subs) {
    if (sub.status !== 'active') continue;
    if (sub.autopayEnabled) continue;
    if (new Date(sub.nextOrderDate) > now) continue;

    try {
      results.push(await renewSubscription(sub, { paymentMethod: 'cod' }));
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
  computeRenewalAmount,
  renewSubscription,
  processDueSubscriptions,
};
