/**
 * Digital gift cards: a fixed value purchased via Razorpay and redeemed as a
 * ₹-for-₹ discount at checkout (see orderBuilder.js), stackable with a
 * coupon and reward points. Balance is an append-only ledger, same reasoning
 * as utils/loyalty.js — derived from history rather than a mutable field, so
 * two near-simultaneous redemptions can never race each other into a lost
 * update.
 */
const { v4: uuid } = require('uuid');
const db = require('../data/db');

const DENOMINATIONS = [500, 1000, 2000, 5000];
const MIN_AMOUNT = 200;
const MAX_AMOUNT = 10000;
const VALIDITY_DAYS = 365;

// Excludes visually-ambiguous characters (0/O, 1/I/L) since this code is
// sometimes read aloud or typed by hand off a screenshot.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomSuffix(length = 8) {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `GIFT${randomSuffix()}`;
    if (!(await db.get('gift-cards', code))) return code;
  }
  throw new Error('Could not generate a unique gift card code — please try again.');
}

async function getLedger(code) {
  return (await db.list('gift-card-ledger')).filter((e) => e.code === code);
}

async function getBalance(code) {
  const ledger = await getLedger(code);
  return ledger.reduce((sum, e) => sum + e.amount, 0);
}

/** Looks up a gift card by code and returns it with its live balance, or
 * null if the code doesn't exist, was cancelled, has expired, or is already
 * fully spent. */
async function findValidGiftCard(code) {
  if (!code) return null;
  const card = await db.get('gift-cards', code.trim().toUpperCase());
  if (!card || card.status === 'cancelled') return null;
  if (card.expiresAt && new Date(card.expiresAt) < new Date()) return null;
  const balance = await getBalance(card.id);
  if (balance <= 0) return null;
  return { ...card, balance };
}

async function issueGiftCard({ amount, purchaserUserId, purchaserName, purchaserEmail, recipientName, recipientEmail, recipientPhone, message, payment }) {
  const code = await generateUniqueCode();
  const now = new Date();
  const card = {
    id: code,
    initialValue: amount,
    purchaserUserId: purchaserUserId || null,
    purchaserName: purchaserName || '',
    purchaserEmail: purchaserEmail || '',
    recipientName: recipientName || '',
    recipientEmail: recipientEmail || '',
    recipientPhone: recipientPhone || '',
    message: (message || '').slice(0, 500),
    status: 'active',
    payment: payment || null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };
  await db.put('gift-cards', card);
  await db.put('gift-card-ledger', {
    id: uuid(),
    code,
    type: 'issue',
    amount,
    orderId: null,
    createdAt: now.toISOString(),
  });
  return card;
}

/** Records a redemption against an order. Assumes the amount was already
 * clamped to the card's live balance (see orderBuilder.js buildOrderItems). */
async function redeemGiftCardForOrder(code, amount, order) {
  if (amount <= 0) return;
  await db.put('gift-card-ledger', {
    id: uuid(),
    code,
    type: 'redeem',
    amount: -amount,
    orderId: order.id,
    createdAt: new Date().toISOString(),
  });
}

async function cancelGiftCard(code) {
  const card = await db.get('gift-cards', code.trim().toUpperCase());
  if (!card) return null;
  card.status = 'cancelled';
  await db.put('gift-cards', card);
  return card;
}

module.exports = {
  DENOMINATIONS,
  MIN_AMOUNT,
  MAX_AMOUNT,
  findValidGiftCard,
  getBalance,
  getLedger,
  issueGiftCard,
  redeemGiftCardForOrder,
  cancelGiftCard,
};
