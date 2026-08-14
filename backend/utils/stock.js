/**
 * Taking stock off when something sells, and putting it back when it doesn't.
 *
 * Until this existed, nothing in the app reduced a size's stock. Checkout
 * *checked* the number and then left it alone, so it only ever moved when
 * somebody edited it by hand in Admin → Products. Everything built on top of
 * it was therefore wrong the moment a sale happened: the low-stock warnings on
 * Today and the Dashboard, the days-left forecast, What to Buy, and — worst —
 * the out-of-stock guard meant to stop overselling, which could never fire
 * because the count never fell.
 *
 * Three rules run through this file:
 *
 *  1. Once per order, ever. Every movement is stamped on the order itself
 *     (stockAdjustedAt / stockRestoredAt), so a retry, a double-click or a
 *     restart can't take the same bottles off twice.
 *
 *  2. Orders that predate this file are left alone. They were never
 *     decremented, so restoring them on a later cancellation would invent
 *     stock — the restore is gated on the order actually having been adjusted.
 *
 *  3. A reservation against a future pressing is not stock. Those bottles are
 *     still seed in a sack; the pressing's own capacity check is what limits
 *     them, and orderBuilder deliberately skips the stock test for them.
 *
 * On the race: two orders placed in the same instant can both read the same
 * starting count and the second write can clobber the first, losing one
 * decrement. That is a property of this app's read-modify-write data layer,
 * not something introduced here — every other counter in the codebase shares
 * it, and fixing it properly needs transactions the JSON and MySQL layers
 * don't currently expose. It is far narrower than the bug it replaces: the
 * count is now right except in a collision, instead of always wrong.
 */
const db = require('./../data/db');

/** Lines that draw on real stock — everything except pressing reservations. */
const stockLines = (order) => (order.items || []).filter((i) => i.productId && i.size && !i.pressingId);

/**
 * Applies a signed change to each line's size. direction -1 sells, +1 returns.
 * Products are re-read per id so the value written is based on what is on disk
 * now, not on whatever the caller happened to be holding.
 */
async function moveStock(order, direction) {
  const moved = [];
  const byProduct = new Map();
  for (const line of stockLines(order)) {
    if (!byProduct.has(line.productId)) byProduct.set(line.productId, []);
    byProduct.get(line.productId).push(line);
  }

  for (const [productId, lines] of byProduct) {
    const product = await db.get('products', productId);
    // A product deleted since the order was placed has nothing to adjust. The
    // order stays valid — it is a record of something that happened.
    if (!product || !Array.isArray(product.sizes)) continue;

    let touched = false;
    for (const line of lines) {
      const size = product.sizes.find((s) => s.label === line.size);
      if (!size) continue;
      const qty = Math.max(0, Math.floor(Number(line.quantity) || 0));
      if (qty === 0) continue;
      const before = Math.max(0, Math.floor(Number(size.stock) || 0));
      // Floored at zero: a count can be short of what an order took (someone
      // edited it by hand mid-flight), and a negative stock number would show
      // up as "-3 left" on the shop and break every forecast reading it.
      const after = Math.max(0, before + direction * qty);
      if (after !== before) {
        size.stock = after;
        touched = true;
        moved.push({ productId, name: product.name, size: line.size, from: before, to: after });
      }
    }
    if (touched) await db.put('products', product);
  }
  return moved;
}

/** True while this order is holding stock off the shelf. */
const isHoldingStock = (order) => !!order.stockAdjustedAt && !order.stockRestoredAt;

/**
 * Takes an order's goods off the shelf. Safe to call more than once — the
 * second call does nothing and says so.
 *
 * Also handles the un-cancel: an admin who cancels an order and then puts it
 * back to confirmed has taken the bottles off the shelf again, so a previous
 * restore is cleared and the stock deducted afresh.
 */
async function applyStockForOrder(order) {
  if (isHoldingStock(order)) return { skipped: 'already taken off', moved: [] };
  const moved = await moveStock(order, -1);
  order.stockAdjustedAt = new Date().toISOString();
  delete order.stockRestoredAt;
  await db.put('orders', order);
  return { moved };
}

/**
 * Puts the goods back — for a cancellation, where they never left the mill.
 *
 * Deliberately NOT called for a return or a refund. A bottle of oil that has
 * been to a customer's kitchen and come back is not something this code can
 * decide is fit to sell again; that is a judgement for whoever opens the
 * parcel. Restoring it automatically would quietly overstate what is on the
 * shelf, which is the same class of error this whole file exists to remove.
 */
async function restoreStockForOrder(order) {
  if (!order.stockAdjustedAt) return { skipped: 'was never taken off', moved: [] };
  if (order.stockRestoredAt) return { skipped: 'already put back', moved: [] };
  const moved = await moveStock(order, +1);
  order.stockRestoredAt = new Date().toISOString();
  await db.put('orders', order);
  return { moved };
}

module.exports = { applyStockForOrder, restoreStockForOrder, isHoldingStock, stockLines };
