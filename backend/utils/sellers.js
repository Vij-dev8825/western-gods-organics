/**
 * Seller marketplace earnings: an approved seller (see admin.js's PATCH
 * /admin/seller-applications/:id) lists their own products (see
 * routes/sellerPortal.js) and earns a share of each sale once the order is
 * delivered — same trigger as loyalty points and affiliate commission, so a
 * cancelled/returned order never pays out on a sale that didn't happen.
 * Earnings are money owed to the seller, paid out externally (bank
 * transfer/UPI) by the admin — never store credit the seller can spend
 * themselves. Balance is an append-only ledger, same reasoning as
 * utils/affiliates.js and utils/loyalty.js: derived from history, immune to
 * lost updates.
 *
 * IMPORTANT naming note: a seller's `sellerPlatformFeeRate` is the inverse of
 * an affiliate's `commissionRate` — it's the % the PLATFORM keeps, not the %
 * the seller earns. The seller is credited `netShare * (1 - rate/100)`, not
 * `netShare * (rate/100)` — do not copy the affiliate math verbatim.
 */
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { notifyUser } = require('./notify');

async function getLedger(sellerId) {
  return (await db.list('seller-ledger')).filter((e) => e.sellerId === sellerId);
}

async function getBalance(sellerId) {
  const ledger = await getLedger(sellerId);
  return ledger.reduce((sum, e) => sum + e.amount, 0);
}

async function getSummary(sellerId) {
  const ledger = await getLedger(sellerId);
  const totalEarned = ledger.filter((e) => e.type === 'earn').reduce((sum, e) => sum + e.amount, 0);
  const totalPaid = ledger.filter((e) => e.type === 'payout').reduce((sum, e) => sum + Math.abs(e.amount), 0);
  return {
    totalEarned,
    totalPaid,
    balance: totalEarned - totalPaid,
    history: ledger.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  };
}

/** What each seller in an order is owed, keyed by sellerId.
 *
 * Re-fetches each line item's CURRENT product record to find its sellerId
 * (never trusts anything snapshotted on the order itself) — an order can mix
 * a seller's products with the store's own or with other sellers', so unlike
 * affiliate commission (one affiliate per whole order), each seller's share
 * of order-level discount/points/gift-card is apportioned pro-rata by their
 * share of the pre-discount subtotal, then that seller's own platform-fee
 * rate is applied only to their own net share.
 *
 * Shared by the crediting path below and by the seller's own orders list
 * (routes/sellerPortal.js), which shows what an order will be worth before
 * it's delivered — one implementation so the estimate and the eventual
 * credit can't drift apart.
 *
 * When calling this in a loop (the seller's orders list does, once per order),
 * pass the same `cache` object every time — the product table and each seller
 * record are then read once for the whole loop instead of once per order. */
async function computeSellerShares(order, cache = {}) {
  if (!cache.productById) {
    cache.productById = Object.fromEntries((await db.list('products')).map((p) => [p.id, p]));
  }
  if (!cache.sellerById) cache.sellerById = {};
  const { productById, sellerById } = cache;

  const sellerItems = {};
  let orderSubtotal = 0;
  for (const item of order.items) {
    const lineTotal = item.price * item.quantity;
    orderSubtotal += lineTotal;
    const sellerId = productById[item.productId]?.sellerId;
    if (!sellerId) continue;
    if (!sellerItems[sellerId]) sellerItems[sellerId] = { subtotal: 0, items: [] };
    sellerItems[sellerId].subtotal += lineTotal;
    sellerItems[sellerId].items.push(item);
  }
  if (orderSubtotal <= 0) return {};

  const shares = {};
  for (const [sellerId, { subtotal, items }] of Object.entries(sellerItems)) {
    if (!(sellerId in sellerById)) sellerById[sellerId] = await db.get('users', sellerId);
    const seller = sellerById[sellerId];
    if (!seller?.isSeller) continue;

    const shareRatio = subtotal / orderSubtotal;
    const shareOfDiscount = (order.discount || 0) * shareRatio;
    const shareOfPoints = (order.pointsRedeemed || 0) * shareRatio;
    const shareOfGiftCard = (order.giftCardApplied || 0) * shareRatio;
    const netShare = Math.max(0, subtotal - shareOfDiscount - shareOfPoints - shareOfGiftCard);

    // Fail closed if the rate is somehow missing (shouldn't happen — the
    // approval route always sets it) rather than risk crediting the full
    // amount on an unset rate.
    const feeRate = seller.sellerPlatformFeeRate ?? 100;
    shares[sellerId] = {
      seller,
      items,
      subtotal,
      amount: Math.round(netShare * (1 - feeRate / 100)),
    };
  }
  return shares;
}

async function creditSellerEarningsForOrder(order) {
  const shares = await computeSellerShares(order);
  for (const [sellerId, { seller, amount }] of Object.entries(shares)) {
    if (amount <= 0) continue;
    await db.put('seller-ledger', {
      id: uuid(),
      sellerId,
      orderId: order.id,
      type: 'earn',
      amount,
      note: `Order ${order.orderNumber}`,
      createdAt: new Date().toISOString(),
    });
    await notifyUser(seller, {
      title: `You earned ₹${amount} from a sale!`,
      message: `Order ${order.orderNumber} was delivered — ₹${amount} has been added to your seller balance.`,
      channels: { inapp: true, email: true },
    });
  }
}

/** Records a manual payout (bank transfer/UPI, done outside this app) as a
 * negative ledger entry. Rejects an amount beyond the current balance so the
 * ledger can never go negative through normal use. */
async function recordPayout(sellerId, amount, note) {
  if (!(amount > 0)) throw new Error('Payout amount must be greater than zero.');
  const balance = await getBalance(sellerId);
  if (amount > balance) throw new Error(`Payout amount exceeds current balance of ₹${balance}.`);
  await db.put('seller-ledger', {
    id: uuid(),
    sellerId,
    orderId: null,
    type: 'payout',
    amount: -amount,
    note: note || 'Payout',
    createdAt: new Date().toISOString(),
  });
}

module.exports = {
  getLedger,
  getBalance,
  getSummary,
  computeSellerShares,
  creditSellerEarningsForOrder,
  recordPayout,
};
