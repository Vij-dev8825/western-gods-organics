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

/** Re-fetches each line item's CURRENT product record to find its sellerId
 * (never trusts anything snapshotted on the order itself) — an order can mix
 * a seller's products with the store's own or with other sellers', so unlike
 * affiliate commission (one affiliate per whole order), each seller's share
 * of order-level discount/points/gift-card is apportioned pro-rata by their
 * share of the pre-discount subtotal, then that seller's own platform-fee
 * rate is applied only to their own net share. */
async function creditSellerEarningsForOrder(order) {
  const products = await db.list('products');
  const productById = Object.fromEntries(products.map((p) => [p.id, p]));

  const sellerSubtotals = {};
  let orderSubtotal = 0;
  for (const item of order.items) {
    const lineTotal = item.price * item.quantity;
    orderSubtotal += lineTotal;
    const sellerId = productById[item.productId]?.sellerId;
    if (sellerId) sellerSubtotals[sellerId] = (sellerSubtotals[sellerId] || 0) + lineTotal;
  }
  if (orderSubtotal <= 0) return;

  for (const [sellerId, sellerSubtotal] of Object.entries(sellerSubtotals)) {
    const seller = await db.get('users', sellerId);
    if (!seller?.isSeller) continue;

    const shareRatio = sellerSubtotal / orderSubtotal;
    const shareOfDiscount = (order.discount || 0) * shareRatio;
    const shareOfPoints = (order.pointsRedeemed || 0) * shareRatio;
    const shareOfGiftCard = (order.giftCardApplied || 0) * shareRatio;
    const netShare = Math.max(0, sellerSubtotal - shareOfDiscount - shareOfPoints - shareOfGiftCard);

    // Fail closed if the rate is somehow missing (shouldn't happen — the
    // approval route always sets it) rather than risk crediting the full
    // amount on an unset rate.
    const feeRate = seller.sellerPlatformFeeRate ?? 100;
    const amount = Math.round(netShare * (1 - feeRate / 100));
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
  creditSellerEarningsForOrder,
  recordPayout,
};
