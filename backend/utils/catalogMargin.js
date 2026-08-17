/**
 * What every size in the catalogue would earn if it sold today.
 *
 * Admin → Profit answers "what did we keep last month", and it is built from
 * orders. That makes it silent for a shop that has just spent an hour entering
 * costs and has no orders yet — the work disappears until somebody buys
 * something, which is exactly when it is least useful to discover a mistake.
 *
 * This answers the other question: "given what these cost me and what I charge,
 * which of my products is actually worth selling?" It needs no orders at all,
 * and it stays true when a seed price moves, unlike a table worked out by hand.
 *
 * Deliberately gross margin — price less what the goods cost — and nothing
 * else. The gateway fee depends on how a customer chooses to pay, the courier
 * on where they live, and a commission on who referred them. None of that is
 * knowable per size, and folding a guess at it into a headline number would
 * make this disagree with the profit report. Where the two are both shown, the
 * relationship should be plain: this is the ceiling, Profit is what survived.
 */
const db = require('./../data/db');
const { isNumber, finiteOrNull } = require('./num');

/** One row per priced size, with margin where the cost is known. */
function sizeRows(product) {
  return (product.sizes || []).map((size) => {
    const price = finiteOrNull(size.price);
    // isNumber, not a truthiness check: the product routes store null for an
    // unrecorded cost, and Number(null) is 0 — which would report a size as
    // pure profit rather than as uncosted.
    const cost = isNumber(size.costPrice) ? Number(size.costPrice) : null;
    const wholesale = isNumber(size.wholesalePrice) && Number(size.wholesalePrice) > 0
      ? Number(size.wholesalePrice)
      : null;

    const known = price !== null && cost !== null;
    const margin = known ? Math.round(price - cost) : null;
    const marginPercent = known && price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : null;
    const tradeMargin = wholesale !== null && cost !== null ? Math.round(wholesale - cost) : null;
    const tradeMarginPercent =
      tradeMargin !== null && wholesale > 0 ? Math.round((tradeMargin / wholesale) * 1000) / 10 : null;

    return {
      label: size.label,
      price,
      cost,
      wholesale,
      margin,
      marginPercent,
      tradeMargin,
      tradeMarginPercent,
      // A trade rate at or below cost is the one thing here worth shouting
      // about — it is a promise on a printed rate card to lose money.
      tradeBelowCost: tradeMargin !== null && tradeMargin <= 0,
      costed: known,
    };
  });
}

async function buildCatalogMargins() {
  const products = await db.list('products');

  const rows = products
    .filter((p) => p.active !== false)
    .map((p) => {
      const sizes = sizeRows(p).filter((s) => s.price !== null);
      const costed = sizes.filter((s) => s.costed);
      // Ranked on the best size rather than an average: what a shop wants to
      // know is what this product can earn when it sells well, and averaging a
      // 5 L jar against a 100 g sample answers nothing.
      const best = costed.reduce((top, s) => (top === null || s.margin > top.margin ? s : top), null);
      return {
        id: p.id,
        name: p.name,
        category: p.category || 'other',
        sizes,
        sizesCosted: costed.length,
        sizesTotal: sizes.length,
        bestMargin: best ? best.margin : null,
        bestMarginPercent: best ? best.marginPercent : null,
        bestSizeLabel: best ? best.label : null,
        anyTradeBelowCost: sizes.some((s) => s.tradeBelowCost),
      };
    })
    .filter((p) => p.sizesTotal > 0);

  // Costed products first, best earner at the top; everything uncosted falls
  // to the bottom, which is also the to-do list.
  rows.sort((a, b) => {
    if ((a.bestMargin === null) !== (b.bestMargin === null)) return a.bestMargin === null ? 1 : -1;
    return (b.bestMargin || 0) - (a.bestMargin || 0);
  });

  const allSizes = rows.flatMap((r) => r.sizes);
  const costedSizes = allSizes.filter((s) => s.costed);

  return {
    products: rows,
    summary: {
      products: rows.length,
      sizes: allSizes.length,
      sizesCosted: costedSizes.length,
      sizesUncosted: allSizes.length - costedSizes.length,
      // Straight average across costed sizes, not weighted by sales — there
      // are no sales to weight by, and saying so is better than implying one.
      averageMarginPercent: costedSizes.length
        ? Math.round((costedSizes.reduce((sum, s) => sum + s.marginPercent, 0) / costedSizes.length) * 10) / 10
        : null,
      tradeBelowCost: allSizes.filter((s) => s.tradeBelowCost).length,
    },
  };
}

module.exports = { buildCatalogMargins, sizeRows };
