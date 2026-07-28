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

async function getLedger(userId) {
  return (await db.list('loyalty-ledger')).filter((e) => e.userId === userId);
}

async function getPointsBalance(userId) {
  const ledger = await getLedger(userId);
  return ledger.reduce((sum, e) => sum + e.points, 0);
}

function pointsForOrderTotal(orderTotal) {
  return Math.floor(orderTotal / EARN_RATE_INR_PER_POINT);
}

/** Credits points for a delivered order and notifies the customer. */
async function creditPointsForOrder(order) {
  const points = pointsForOrderTotal(order.total);
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
  pointsForOrderTotal,
  creditPointsForOrder,
  redeemPointsForOrder,
  REDEEM_VALUE_INR_PER_POINT,
};
