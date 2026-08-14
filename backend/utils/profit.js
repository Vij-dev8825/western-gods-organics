/**
 * What the shop actually keeps.
 *
 * Every other number in this admin is a sales figure. Revenue is not profit,
 * and a mill that presses its own oil has real costs — seed, bottles, labels,
 * the courier, the payment gateway, and whatever a seller or affiliate is owed
 * out of the sale. This turns "we took ₹40,000 last month" into "we kept ₹X".
 *
 * Two rules run through all of it:
 *
 * 1. Cost is read from the order line, never from the product today. A cost
 *    price that changes next season must not silently rewrite last season's
 *    profit. Lines placed before costs were recorded carry no cost at all —
 *    those orders are *excluded* from the margin rather than counted as free
 *    to make, because a report that quietly inflates profit is worse than one
 *    that admits it doesn't know.
 *
 * 2. Nothing is estimated that could be derived. Shipping isn't stored on an
 *    order, but the total is built from a known formula, so it comes back out
 *    of that formula exactly — for orders placed long before this file existed.
 */
const db = require('../data/db');
const { REDEEM_VALUE_INR_PER_POINT } = require('./loyalty');
const { getPaymentMethodsConfig } = require('./paymentMethods');
const { isNumber, finiteOrNull } = require('./num');

// Money that came in and stayed in.
const EARNED_STATUS = 'delivered';
// Money that went back out, or never arrived.
const LOST_STATUSES = new Set(['cancelled', 'refunded', 'returned']);

/** Merchandise value of an order's lines, at the price actually charged. */
function lineSubtotal(order) {
  return (order.items || []).reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
}

/**
 * Delivery charged on an order, recovered from the total.
 *
 * createOrderRecord doesn't persist it, but buildOrderItems composes the total
 * as subtotal + shipping − discount − prepaidDiscount − points − giftCard, and
 * every one of those terms is stored. Rearranging gives shipping back exactly,
 * with no guessing and nothing to backfill.
 */
function deriveShipping(order) {
  const reductions =
    (Number(order.discount) || 0) +
    (Number(order.prepaidDiscount) || 0) +
    (Number(order.pointsRedeemed) || 0) * REDEEM_VALUE_INR_PER_POINT +
    (Number(order.giftCardApplied) || 0);
  return Math.max(0, Math.round((Number(order.total) || 0) - lineSubtotal(order) + reductions));
}

/** What one order was worth once everything it owed had been paid out.
 *
 * `ledgerByOrder` maps orderId -> rupees owed to affiliates and sellers for it,
 * summed from the append-only ledgers (a reversal is a negative entry, so a
 * refunded order nets to zero without needing a special case here). */
function orderEconomics(order, { gatewayFeeRate, ledgerByOrder }) {
  const items = order.items || [];
  const shipping = deriveShipping(order);
  const charged = Number(order.total) || 0;
  const goodsRevenue = Math.max(0, charged - shipping);

  // A line with no recorded cost isn't a free line — it's an unknown one, and
  // one unknown line makes the whole order's margin unknowable.
  const costKnown = items.length > 0 && items.every((it) => isNumber(it.costPrice));
  const goodsCost = costKnown
    ? items.reduce((sum, it) => sum + finiteOrNull(it.costPrice) * (Number(it.quantity) || 0), 0)
    : null;

  // COD collects cash at the door; only money that went through the gateway
  // is charged a gateway fee. A part-paid COD order was charged on its advance.
  const throughGateway =
    order.paymentMethod === 'razorpay' ? charged
      : order.paymentMethod === 'cod_advance' ? (Number(order.advancePaid) || 0)
        : 0;
  const gatewayFee = Math.round((throughGateway * gatewayFeeRate) / 100);

  const owedOut = ledgerByOrder[order.id] || 0;
  const margin = costKnown ? Math.round(goodsRevenue - goodsCost - gatewayFee - owedOut) : null;

  return { shipping, charged, goodsRevenue, goodsCost, gatewayFee, owedOut, margin, costKnown };
}

/** Rupees owed to affiliates and sellers, per order id. */
async function ledgerTotalsByOrder() {
  const [affiliate, seller] = await Promise.all([
    db.list('affiliate-ledger'),
    db.list('seller-ledger'),
  ]);
  const byOrder = {};
  for (const entry of [...affiliate, ...seller]) {
    // Payouts are the same money leaving later — counting them here as well
    // would charge the shop twice for one commission.
    if (!entry.orderId || entry.type === 'payout') continue;
    byOrder[entry.orderId] = (byOrder[entry.orderId] || 0) + (Number(entry.amount) || 0);
  }
  return byOrder;
}

/**
 * The report behind Admin → Profit.
 *
 * Windows on createdAt, not delivery date: an owner asking "how did last month
 * go" means the month they sold in. Orders still in flight are reported
 * separately rather than folded in, because that money isn't theirs yet.
 */
async function buildProfitReport({ days = 30 } = {}) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const [orders, products, config] = await Promise.all([
    db.list('orders'),
    db.list('products'),
    getPaymentMethodsConfig(),
  ]);
  const ledgerByOrder = await ledgerTotalsByOrder();
  const gatewayFeeRate = Math.min(Math.max(Number(config.gatewayFeePercent) || 0, 0), 100);

  const inWindow = orders.filter((o) => new Date(o.createdAt).getTime() >= since);
  const earned = inWindow.filter((o) => o.status === EARNED_STATUS);
  const lost = inWindow.filter((o) => LOST_STATUSES.has(o.status));
  const inFlight = inWindow.filter((o) => o.status !== EARNED_STATUS && !LOST_STATUSES.has(o.status));

  const totals = {
    orders: earned.length,
    charged: 0, shipping: 0, goodsRevenue: 0, goodsCost: 0, gatewayFee: 0, owedOut: 0, margin: 0,
    ordersWithKnownCost: 0,
    // Revenue, fees and commissions of *only* the orders that could be costed.
    // The subtraction the admin screen shows has to run over one consistent set
    // of orders: taking all revenue and subtracting the cost of some of it
    // would show a number that doesn't reconcile and inflates what was kept.
    goodsRevenueKnown: 0, gatewayFeeKnown: 0, owedOutKnown: 0,
  };
  // Per product+size, so the answer to "which of these is worth pressing" is
  // in the same report as the headline number.
  const byLine = {};

  for (const order of earned) {
    const e = orderEconomics(order, { gatewayFeeRate, ledgerByOrder });
    totals.charged += e.charged;
    totals.shipping += e.shipping;
    totals.goodsRevenue += e.goodsRevenue;
    totals.gatewayFee += e.gatewayFee;
    totals.owedOut += e.owedOut;
    if (e.costKnown) {
      totals.ordersWithKnownCost += 1;
      totals.goodsCost += e.goodsCost;
      totals.margin += e.margin;
      totals.goodsRevenueKnown += e.goodsRevenue;
      totals.gatewayFeeKnown += e.gatewayFee;
      totals.owedOutKnown += e.owedOut;
    }

    for (const it of order.items || []) {
      const key = `${it.productId}|${it.size}`;
      const row = (byLine[key] ||= {
        productId: it.productId, name: it.name || 'Unknown product', size: it.size,
        units: 0, revenue: 0, cost: 0, costKnown: true,
      });
      const qty = Number(it.quantity) || 0;
      row.units += qty;
      row.revenue += (Number(it.price) || 0) * qty;
      if (isNumber(it.costPrice)) row.cost += finiteOrNull(it.costPrice) * qty;
      else row.costKnown = false;
    }
  }

  const lines = Object.values(byLine)
    .map((r) => ({
      ...r,
      margin: r.costKnown ? Math.round(r.revenue - r.cost) : null,
      marginPercent: r.costKnown && r.revenue > 0 ? Math.round(((r.revenue - r.cost) / r.revenue) * 100) : null,
    }))
    .sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity));

  // Which products still need a cost before any of this means anything.
  const missingCost = [];
  for (const p of products) {
    for (const s of p.sizes || []) {
      if (!isNumber(s.costPrice)) missingCost.push({ productId: p.id, name: p.name, size: s.label });
    }
  }

  return {
    days,
    gatewayFeeRate,
    totals: {
      ...totals,
      charged: Math.round(totals.charged),
      shipping: Math.round(totals.shipping),
      goodsRevenue: Math.round(totals.goodsRevenue),
      goodsRevenueKnown: Math.round(totals.goodsRevenueKnown),
      gatewayFeeKnown: Math.round(totals.gatewayFeeKnown),
      owedOutKnown: Math.round(totals.owedOutKnown),
      goodsCost: Math.round(totals.goodsCost),
      margin: Math.round(totals.margin),
      ordersMissingCost: earned.length - totals.ordersWithKnownCost,
      // Sales the report had to set aside, so the gap between this and the
      // headline is stated rather than left to be discovered.
      revenueMissingCost: Math.round(totals.goodsRevenue - totals.goodsRevenueKnown),
    },
    inFlight: { orders: inFlight.length, charged: Math.round(inFlight.reduce((s, o) => s + (Number(o.total) || 0), 0)) },
    lost: { orders: lost.length, charged: Math.round(lost.reduce((s, o) => s + (Number(o.total) || 0), 0)) },
    lines,
    missingCost,
  };
}

module.exports = {
  buildProfitReport,
  orderEconomics,
  deriveShipping,
  lineSubtotal,
  ledgerTotalsByOrder,
  EARNED_STATUS,
  LOST_STATUSES,
};
