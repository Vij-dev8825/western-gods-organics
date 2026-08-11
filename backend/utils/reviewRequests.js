const db = require('../data/db');
const { notifyUser } = require('./notify');

const SITE_URL = process.env.SITE_URL || 'https://westerngodsorganic.com';

// Long enough after delivery that the customer has actually cooked with the
// oil or washed with the soap and has a real opinion — asking the day it
// arrives gets "nice packaging", which helps nobody. Late enough to be
// honest, early enough to still be remembered.
//
// The window's far edge is generous so a missed run (restart, slow tick)
// still catches the order later, but it does close: a request three months
// after delivery reads as a form letter, and the answer wouldn't be worth
// much either.
const MIN_DAYS_AFTER_DELIVERY = 7;
const MAX_DAYS_AFTER_DELIVERY = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

// An order that came back isn't a review prompt, it's a complaint waiting to
// happen — and asking someone who returned the goods to rate them publicly is
// the wrong conversation to start.
const EXCLUDED_STATUSES = new Set(['cancelled', 'returned', 'refunded']);

/**
 * Asks customers to review what they actually bought, once, a week after it
 * reached them.
 *
 * This is the missing half of a review system that was otherwise complete:
 * the form, the photo upload and the display all existed, but nothing ever
 * invited anyone to use them, so no reviews were ever written. Almost nobody
 * returns to a shop unprompted to write about cooking oil; they will answer a
 * direct question a week later.
 *
 * Deliberately asks about ONE product per order rather than listing
 * everything. A single clear request gets answered; a checklist gets ignored,
 * and the customer can review the rest from the product page anyway.
 */
async function processReviewRequests() {
  const [orders, users, reviews] = await Promise.all([
    db.list('orders'),
    db.list('users'),
    db.list('reviews'),
  ]);
  const usersById = new Map(users.map((u) => [u.id, u]));

  // Everything this customer has already had their say on. Asking again for a
  // product they've reviewed is the fastest way to get a request muted.
  const reviewedByUser = new Map();
  for (const r of reviews) {
    if (!reviewedByUser.has(r.userId)) reviewedByUser.set(r.userId, new Set());
    reviewedByUser.get(r.userId).add(r.productId);
  }

  const now = Date.now();
  const results = [];

  for (const order of orders) {
    if (!order.deliveredAt || order.reviewRequestSentAt) continue;
    if (EXCLUDED_STATUSES.has(order.status)) continue;

    const daysSince = (now - new Date(order.deliveredAt).getTime()) / DAY_MS;
    if (daysSince < MIN_DAYS_AFTER_DELIVERY || daysSince > MAX_DAYS_AFTER_DELIVERY) continue;

    const user = usersById.get(order.userId);
    if (!user) continue;

    const alreadyReviewed = reviewedByUser.get(user.id) || new Set();
    // Highest-value line first: the thing they spent most on is the thing
    // they have the most to say about, and its review is worth the most to
    // the next shopper deciding on it.
    const candidate = (order.items || [])
      .filter((i) => i.productId && !alreadyReviewed.has(i.productId))
      .sort((a, b) => b.price * b.quantity - a.price * a.quantity)[0];

    if (!candidate) {
      // Nothing left to ask about — mark it done so this order is never
      // reconsidered on every future run.
      order.reviewRequestSentAt = new Date(now).toISOString();
      await db.put('orders', order);
      results.push({ orderId: order.id, skipped: 'all items already reviewed' });
      continue;
    }

    try {
      await notifyUser(user, {
        title: `How is your ${candidate.name}?`,
        message:
          `You've had the ${candidate.name} (${candidate.size}) for about a week now. ` +
          `Would you tell other shoppers what you think? A line or two — and a photo if you have one — ` +
          `helps someone else decide: ${SITE_URL}/product/${candidate.productId}`,
        meta: { orderId: order.id, productId: candidate.productId },
        channels: { inapp: true, email: true, whatsapp: true },
      });

      order.reviewRequestSentAt = new Date(now).toISOString();
      await db.put('orders', order);
      results.push({ orderId: order.id, productId: candidate.productId, requested: true });
    } catch (err) {
      // Left unmarked on failure so the next run retries it — the window is
      // wide enough to absorb a few missed attempts.
      results.push({ orderId: order.id, error: err.message });
    }
  }

  return results;
}

module.exports = { processReviewRequests };
