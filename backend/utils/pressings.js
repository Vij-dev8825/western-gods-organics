/**
 * Scheduled pressings — a run of the mill that hasn't happened yet, which
 * customers can reserve a share of in advance.
 *
 * Every other scarcity signal on this site describes stock that already
 * exists. This one describes oil that doesn't: a date the seeds go under the
 * wood press, and a number of bottles that run will yield. That makes it the
 * one kind of urgency here that is simply true — the run is genuinely
 * limited, and the date is genuinely fixed by the mill's schedule, so nothing
 * has to be manufactured to create it.
 *
 * A reservation is not a separate kind of transaction. It is an ordinary
 * order whose line carries a `pressingId`, so it inherits payment, invoicing,
 * notifications, loyalty and refunds from the machinery that already works,
 * instead of a parallel system that would have to reimplement all of it.
 */
const db = require('../data/db');

const STATUSES = ['open', 'pressed', 'cancelled'];

// Orders that no longer represent a claim on the run. A cancelled or refunded
// reservation frees its bottles for someone else rather than holding them
// against a customer who has already walked away.
const RELEASED_ORDER_STATUSES = new Set(['cancelled', 'refunded', 'returned']);

/** Bottles already spoken for on a given pressing.
 *
 * Derived by counting orders every time rather than kept as a running total
 * on the pressing itself. A stored counter drifts the first time an order is
 * cancelled, refunded or edited by hand, and a drifted counter here means
 * either overselling a run that can't be repeated or turning away customers
 * for bottles that were never actually claimed. */
async function countReserved(pressingId, orders) {
  const all = orders || (await db.list('orders'));
  return all.reduce((sum, order) => {
    if (RELEASED_ORDER_STATUSES.has(order.status)) return sum;
    return sum + (order.items || []).reduce(
      (n, item) => (item.pressingId === pressingId ? n + (Number(item.quantity) || 0) : n),
      0
    );
  }, 0);
}

/** A pressing with its live reservation count attached. */
async function describe(pressing, orders) {
  const reserved = await countReserved(pressing.id, orders);
  const unitsOffered = Number(pressing.unitsOffered) || 0;
  return {
    ...pressing,
    reserved,
    unitsRemaining: Math.max(0, unitsOffered - reserved),
  };
}

/** Pressings a customer can still reserve from: open, still in the future,
 * and not already fully spoken for. */
async function listOpen({ productId } = {}) {
  const [pressings, orders] = await Promise.all([db.list('pressings'), db.list('orders')]);
  const now = Date.now();
  const open = pressings.filter(
    (p) =>
      p.status === 'open' &&
      (!productId || p.productId === productId) &&
      new Date(p.pressDate).getTime() > now
  );
  const described = await Promise.all(open.map((p) => describe(p, orders)));
  return described
    .filter((p) => p.unitsRemaining > 0)
    .sort((a, b) => new Date(a.pressDate) - new Date(b.pressDate));
}

async function listAll() {
  const [pressings, orders] = await Promise.all([db.list('pressings'), db.list('orders')]);
  const described = await Promise.all(pressings.map((p) => describe(p, orders)));
  return described.sort((a, b) => new Date(b.pressDate) - new Date(a.pressDate));
}

/**
 * Decides whether a reservation can be accepted, re-reading the pressing and
 * the current reservation count rather than trusting anything the client
 * sent. Returns an error string, or null when the reservation is good.
 *
 * `quantityInCart` is counted against the remaining bottles so two lines for
 * the same pressing in one order can't each pass a check the pair would fail.
 */
async function validateReservation(pressingId, productId, size, quantity, orders) {
  const pressing = await db.get('pressings', pressingId);
  if (!pressing) return 'That pressing is no longer scheduled.';
  if (pressing.status === 'cancelled') return 'That pressing has been cancelled.';
  if (pressing.status === 'pressed') return 'That pressing has already been done — this product is available to buy normally now.';
  if (new Date(pressing.pressDate).getTime() <= Date.now()) return 'Reservations for that pressing have closed.';
  if (pressing.productId !== productId || pressing.size !== size) {
    return 'That pressing is for a different product or size.';
  }

  const reserved = await countReserved(pressingId, orders);
  const remaining = (Number(pressing.unitsOffered) || 0) - reserved;
  if (remaining <= 0) return 'That pressing is fully reserved.';
  if (quantity > remaining) {
    return `Only ${remaining} bottle${remaining === 1 ? '' : 's'} left in that pressing.`;
  }
  return null;
}

module.exports = { STATUSES, countReserved, describe, listOpen, listAll, validateReservation };
