/**
 * Reward points: earned on delivered orders, redeemable as a ₹-for-point
 * discount on a future order. Stored as an append-only ledger (rather than a
 * running counter on the user record) so the balance is always derived from
 * history — no separate total to drift out of sync.
 *
 * Earn rate: 1 point per ₹10 paid (on the amount actually paid, i.e. after
 * any discount/points already applied to that order — so redeeming points
 * doesn't let a customer re-earn points on the portion they didn't pay).
 * Redeem rate: 1 point = ₹1.
 */
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { notifyUser } = require('./notify');

const EARN_RATE_INR_PER_POINT = 10;
const REDEEM_VALUE_INR_PER_POINT = 1;

// Tiers are based on LIFETIME points earned (never reduced by redemptions —
// see getLifetimeEarnedPoints), so spending points on a discount can never
// demote a customer. Ordered highest-first so tierForLifetimePoints can
// return the first threshold met. earnMultiplier applies to future orders
// only, based on the tier held BEFORE that order's points are credited.
const TIERS = [
  { key: 'gold', label: 'Gold', minLifetimePoints: 1500, earnMultiplier: 1.5, freeShippingMinOrder: 0 },
  { key: 'silver', label: 'Silver', minLifetimePoints: 500, earnMultiplier: 1.25, freeShippingMinOrder: 699 },
  { key: 'bronze', label: 'Bronze', minLifetimePoints: 0, earnMultiplier: 1, freeShippingMinOrder: 999 },
];

async function getLedger(userId) {
  return (await db.list('loyalty-ledger')).filter((e) => e.userId === userId);
}

async function getPointsBalance(userId) {
  const ledger = await getLedger(userId);
  return ledger.reduce((sum, e) => sum + e.points, 0);
}

/** Drives the reward tier, so it counts points from orders the customer
 * actually kept: a refunded order's `earn` is cancelled out by the matching
 * `reversal` (see reversePointsForOrder) and stops counting toward tier
 * progress. Without that, buying big, reaching Gold and returning everything
 * would leave the tier standing. */
async function getLifetimeEarnedPoints(userId) {
  const ledger = await getLedger(userId);
  return ledger
    .filter((e) => e.type === 'earn' || e.type === 'reversal')
    .reduce((sum, e) => sum + e.points, 0);
}

function tierForLifetimePoints(lifetimePoints) {
  return TIERS.find((t) => lifetimePoints >= t.minLifetimePoints);
}

// Silver/Gold perk beyond shipping — early access to products still inside
// their earlyAccessUntil window (see routes/products.js and orderBuilder.js).
const EARLY_ACCESS_TIER_KEYS = ['silver', 'gold'];
async function hasEarlyAccessPerk(userId) {
  if (!userId) return false;
  const lifetimePoints = await getLifetimeEarnedPoints(userId);
  return EARLY_ACCESS_TIER_KEYS.includes(tierForLifetimePoints(lifetimePoints).key);
}

/** Full tier snapshot for a user: current tier, perks, and progress to the next one.
 * baseFreeShippingThreshold is the admin-configured domestic threshold
 * (see utils/shippingSettings.js) — Bronze uses it as-is, while Silver/Gold
 * keep their own fixed, better-than-base perks regardless of that setting. */
async function getTierInfo(userId, baseFreeShippingThreshold = 999) {
  const lifetimePoints = await getLifetimeEarnedPoints(userId);
  const tier = tierForLifetimePoints(lifetimePoints);
  const idx = TIERS.indexOf(tier);
  const next = idx > 0 ? TIERS[idx - 1] : null;
  return {
    key: tier.key,
    label: tier.label,
    lifetimePoints,
    earnMultiplier: tier.earnMultiplier,
    freeShippingMinOrder: tier.key === 'bronze' ? baseFreeShippingThreshold : tier.freeShippingMinOrder,
    nextTier: next ? { key: next.key, label: next.label, pointsNeeded: next.minLifetimePoints - lifetimePoints } : null,
  };
}

function pointsForOrderTotal(orderTotal) {
  return Math.floor(orderTotal / EARN_RATE_INR_PER_POINT);
}

/** Credits points for a delivered order (at the customer's tier multiplier
 * held BEFORE this order) and notifies the customer. */
async function creditPointsForOrder(order) {
  const lifetimeBefore = await getLifetimeEarnedPoints(order.userId);
  const tier = tierForLifetimePoints(lifetimeBefore);
  const points = Math.floor(pointsForOrderTotal(order.total) * tier.earnMultiplier);
  if (points <= 0) return;

  await db.put('loyalty-ledger', {
    id: uuid(),
    userId: order.userId,
    orderId: order.id,
    type: 'earn',
    points,
    note: `Order ${order.orderNumber}`,
    createdAt: new Date().toISOString(),
  });

  const user = await db.get('users', order.userId);
  if (user) {
    await notifyUser(user, {
      title: `You earned ${points} reward points!`,
      message: `Order ${order.orderNumber} was delivered — ${points} points (worth ₹${points * REDEEM_VALUE_INR_PER_POINT}) have been added to your account.`,
      meta: { orderId: order.id },
      channels: { inapp: true, email: true },
    });
  }
}

/** Takes back the points earned on a delivered order that was later refunded
 * or cancelled. Offsetting entry rather than a delete (append-only ledger),
 * and idempotent so re-marking a return as refunded can't double-deduct.
 *
 * Note this only reverses what the order EARNED. Points the customer spent on
 * the order are left alone — handing those back on top of a cash refund would
 * pay them twice for the same return. */
async function reversePointsForOrder(order, reason = 'refunded') {
  const forOrder = (await db.list('loyalty-ledger')).filter((e) => e.orderId === order.id);
  if (forOrder.some((e) => e.type === 'reversal')) return;
  const earn = forOrder.find((e) => e.type === 'earn');
  if (!earn) return;

  await db.put('loyalty-ledger', {
    id: uuid(),
    userId: earn.userId,
    orderId: order.id,
    type: 'reversal',
    points: -Math.abs(earn.points),
    note: `Order ${order.orderNumber} ${reason}`,
    createdAt: new Date().toISOString(),
  });
  const user = await db.get('users', earn.userId);
  if (user) {
    await notifyUser(user, {
      title: `${Math.abs(earn.points)} reward points reversed`,
      message: `Order ${order.orderNumber} was ${reason}, so the ${Math.abs(earn.points)} points earned on it have been removed from your account.`,
      meta: { orderId: order.id },
      channels: { inapp: true, email: true },
    });
  }
}

/** Records a points redemption against an order. Assumes the amount was
 * already clamped to the user's balance (see buildOrderItems). */
async function redeemPointsForOrder(userId, order, points) {
  if (points <= 0) return;
  await db.put('loyalty-ledger', {
    id: uuid(),
    userId,
    orderId: order.id,
    type: 'redeem',
    points: -points,
    note: `Order ${order.orderNumber}`,
    createdAt: new Date().toISOString(),
  });
}

module.exports = {
  getLedger,
  getPointsBalance,
  getLifetimeEarnedPoints,
  getTierInfo,
  pointsForOrderTotal,
  creditPointsForOrder,
  reversePointsForOrder,
  redeemPointsForOrder,
  hasEarlyAccessPerk,
  REDEEM_VALUE_INR_PER_POINT,
};
