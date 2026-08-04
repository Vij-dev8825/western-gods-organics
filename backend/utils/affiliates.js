/**
 * Affiliate commission: an approved affiliate account (see admin.js's PATCH
 * /admin/customers/:id/affiliate) shares a code that attributes a sale to
 * them — pure attribution, no discount to the customer — and earns a % of
 * that order once it's delivered (same trigger as loyalty points, so a
 * cancelled/returned order never pays out on a sale that didn't happen).
 * Commission is money owed to the affiliate, paid out externally (bank
 * transfer/UPI) by the admin — unlike loyalty points or a gift card, it is
 * never store credit the affiliate can spend themselves. Balance is an
 * append-only ledger, same reasoning as utils/loyalty.js and
 * utils/giftCards.js: derived from history, immune to lost updates.
 */
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { notifyUser } = require('./notify');

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(length = 6) {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

async function isCodeTaken(code) {
  const users = await db.list('users');
  return users.some((u) => u.affiliateCode === code);
}

/** preferred: an admin-chosen vanity code (e.g. "SARAH10"); falls back to a
 * random one if omitted or already taken. */
async function generateUniqueAffiliateCode(preferred) {
  if (preferred) {
    const clean = preferred.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (clean && !(await isCodeTaken(clean))) return clean;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    if (!(await isCodeTaken(code))) return code;
  }
  throw new Error('Could not generate a unique affiliate code — please try again.');
}

async function findAffiliateByCode(code) {
  if (!code) return null;
  const users = await db.list('users');
  return users.find((u) => u.isAffiliate && u.affiliateCode === code.trim().toUpperCase()) || null;
}

async function getLedger(affiliateUserId) {
  return (await db.list('affiliate-ledger')).filter((e) => e.affiliateUserId === affiliateUserId);
}

async function getCommissionBalance(affiliateUserId) {
  const ledger = await getLedger(affiliateUserId);
  return ledger.reduce((sum, e) => sum + e.amount, 0);
}

async function getCommissionSummary(affiliateUserId) {
  const ledger = await getLedger(affiliateUserId);
  const sumOf = (type) => ledger.filter((e) => e.type === type).reduce((sum, e) => sum + Math.abs(e.amount), 0);
  return {
    totalEarned: sumOf('earn'),
    totalReversed: sumOf('reversal'),
    totalPaid: sumOf('payout'),
    // Plain sum over every entry, exactly as getCommissionBalance does, so a
    // refund reversal shows up here instead of being silently ignored by an
    // earned-minus-paid formula.
    balance: ledger.reduce((sum, e) => sum + e.amount, 0),
    history: ledger.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  };
}

/** Computed on what the store actually nets from the order (after any
 * coupon/points/gift-card the customer used), not the pre-discount subtotal —
 * never pay commission on money the store never collected. */
async function creditCommissionForOrder(order) {
  if (!order.affiliateUserId) return;
  const affiliate = await db.get('users', order.affiliateUserId);
  if (!affiliate?.isAffiliate) return;

  const subtotal = order.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const commissionable = Math.max(0, subtotal - (order.discount || 0) - (order.pointsRedeemed || 0) - (order.giftCardApplied || 0));
  const amount = Math.round((commissionable * (affiliate.commissionRate || 0)) / 100);
  if (amount <= 0) return;

  await db.put('affiliate-ledger', {
    id: uuid(),
    affiliateUserId: order.affiliateUserId,
    orderId: order.id,
    type: 'earn',
    amount,
    note: `Order ${order.orderNumber}`,
    createdAt: new Date().toISOString(),
  });
  await notifyUser(affiliate, {
    title: `You earned ₹${amount} commission!`,
    message: `Order ${order.orderNumber} was delivered — ₹${amount} commission has been added to your affiliate balance.`,
    channels: { inapp: true, email: true },
  });
}

/** Takes the commission back when a delivered order is later refunded or
 * cancelled. Offsetting entry rather than a delete (the ledger is append-only)
 * and idempotent, so re-marking a return as refunded doesn't double-reverse. */
async function reverseCommissionForOrder(order, reason = 'refunded') {
  const forOrder = (await db.list('affiliate-ledger')).filter((e) => e.orderId === order.id);
  if (forOrder.some((e) => e.type === 'reversal')) return;
  const earn = forOrder.find((e) => e.type === 'earn');
  if (!earn) return;

  await db.put('affiliate-ledger', {
    id: uuid(),
    affiliateUserId: earn.affiliateUserId,
    orderId: order.id,
    type: 'reversal',
    amount: -Math.abs(earn.amount),
    note: `Order ${order.orderNumber} ${reason}`,
    createdAt: new Date().toISOString(),
  });
  const affiliate = await db.get('users', earn.affiliateUserId);
  if (affiliate) {
    await notifyUser(affiliate, {
      title: `₹${Math.abs(earn.amount)} commission reversed`,
      message: `Order ${order.orderNumber} was ${reason}, so the ₹${Math.abs(earn.amount)} commission credited for it has been taken back off your balance.`,
      channels: { inapp: true, email: true },
    });
  }
}

/** Records a manual payout (bank transfer/UPI, done outside this app) as a
 * negative ledger entry. Rejects an amount beyond the current balance so the
 * ledger can never go negative through normal use. */
async function recordPayout(affiliateUserId, amount, note) {
  if (!(amount > 0)) throw new Error('Payout amount must be greater than zero.');
  const balance = await getCommissionBalance(affiliateUserId);
  if (amount > balance) throw new Error(`Payout amount exceeds current balance of ₹${balance}.`);
  await db.put('affiliate-ledger', {
    id: uuid(),
    affiliateUserId,
    orderId: null,
    type: 'payout',
    amount: -amount,
    note: note || 'Payout',
    createdAt: new Date().toISOString(),
  });
}

module.exports = {
  generateUniqueAffiliateCode,
  findAffiliateByCode,
  getLedger,
  getCommissionBalance,
  getCommissionSummary,
  creditCommissionForOrder,
  reverseCommissionForOrder,
  recordPayout,
};
