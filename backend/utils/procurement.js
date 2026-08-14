/**
 * What to buy, and who to ring.
 *
 * A mill's buying decisions run a week ahead of its selling ones: seed has to
 * be in the yard before the press turns. Everything needed to work that out
 * already exists here — scheduled pressings, stock, sales velocity, and the
 * grower recorded against each product — but it is spread across four screens,
 * so in practice it gets worked out on paper or not at all.
 *
 * Three questions, in the order they get asked:
 *   1. What have I promised to press, and what does it need?
 *   2. What is running out that I have not scheduled a run for?
 *   3. So what does that add up to, and by when?
 *
 * Raw-material quantities are optional. With no ratio recorded the plan still
 * says how many bottles are due and when — useful on its own — and simply
 * doesn't claim to know the kilos.
 */
const db = require('./../data/db');
const { countReserved } = require('./pressings');
const { finiteOrNull } = require('./num');

// Deliberately the same numbers the dashboard and the Today screen use. Three
// admin screens disagreeing about what "low" means is how you end up trusting
// none of them.
const LOW_STOCK_THRESHOLD = 10;
const FORECAST_WINDOW_DAYS = 30;

/** Units/day per product+size over the trailing window, cancelled orders
 *  excluded since they were never real demand. */
function salesVelocity(orders) {
  const cutoff = Date.now() - FORECAST_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const sold = {};
  for (const o of orders) {
    if (o.status === 'cancelled' || new Date(o.createdAt).getTime() < cutoff) continue;
    for (const it of o.items || []) {
      const key = `${it.productId}|${it.size}`;
      sold[key] = (sold[key] || 0) + (Number(it.quantity) || 0);
    }
  }
  return (productId, size) => (sold[`${productId}|${size}`] || 0) / FORECAST_WINDOW_DAYS;
}

const daysUntil = (iso) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

async function buildProcurementPlan() {
  const [pressings, products, orders] = await Promise.all([
    db.list('pressings'),
    db.list('products'),
    db.list('orders'),
  ]);
  const productById = Object.fromEntries(products.map((p) => [p.id, p]));
  const perDayFor = salesVelocity(orders);

  /* 1 ─ runs already promised ------------------------------------------- */
  const upcoming = pressings
    .filter((p) => p.status === 'open' && new Date(p.pressDate).getTime() > Date.now())
    .sort((a, b) => new Date(a.pressDate) - new Date(b.pressDate));

  const runs = [];
  for (const pressing of upcoming) {
    const product = productById[pressing.productId];
    const size = (product?.sizes || []).find((s) => s.label === pressing.size);
    const reserved = await countReserved(pressing.id, orders);
    const units = Number(pressing.unitsOffered) || 0;
    // finiteOrNull, because an unrecorded ratio is stored as null and
    // Number(null) is 0 — which would quietly claim the run needs no seed.
    const perUnit = finiteOrNull(size?.materialPerUnit);
    runs.push({
      pressingId: pressing.id,
      productId: pressing.productId,
      name: pressing.productName || product?.name || 'Unknown product',
      size: pressing.size,
      pressDate: pressing.pressDate,
      daysAway: daysUntil(pressing.pressDate),
      units,
      reserved,
      // Bottles, caps and labels are needed whether or not a seed ratio is
      // recorded — the run is the number of empties to have ready.
      material: product?.rawMaterial || '',
      materialUnit: product?.materialUnit || 'kg',
      materialNeeded: perUnit === null ? null : Math.round(perUnit * units * 100) / 100,
      grower: product?.growerName || '',
      growerVillage: product?.growerVillage || '',
    });
  }

  /* 2 ─ what is running out with nothing scheduled ------------------------ */
  // A size with a run already booked isn't a procurement problem; it's in
  // section 1 already, and listing it twice would double the apparent work.
  const scheduled = new Set(upcoming.map((p) => `${p.productId}|${p.size}`));

  const runningLow = [];
  for (const p of products) {
    for (const s of p.sizes || []) {
      const stock = Number(s.stock) || 0;
      if (stock > LOW_STOCK_THRESHOLD) continue;
      if (scheduled.has(`${p.id}|${s.label}`)) continue;
      const perDay = perDayFor(p.id, s.label);
      runningLow.push({
        productId: p.id,
        name: p.name,
        size: s.label,
        stock,
        perDay: Math.round(perDay * 100) / 100,
        // Null when nothing has sold recently: an honest "no idea" beats
        // an infinity dressed up as a forecast.
        daysLeft: perDay > 0 ? Math.round(stock / perDay) : null,
        material: p.rawMaterial || '',
        grower: p.growerName || '',
        growerVillage: p.growerVillage || '',
      });
    }
  }
  // Soonest to run dry first; sizes with no recent sales sink to the bottom
  // rather than jumping the queue on an unknown.
  runningLow.sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || a.stock - b.stock);

  /* 3 ─ the shopping list -------------------------------------------------- */
  // Scheduled runs only. What's merely running low has no committed run yet,
  // so how much seed it needs isn't known — putting a guess in the buying
  // list is how you end up with a yard full of the wrong thing.
  const byMaterial = {};
  for (const r of runs) {
    if (!r.material || r.materialNeeded == null) continue;
    const key = `${r.material}|${r.materialUnit}`;
    const row = (byMaterial[key] ||= {
      material: r.material, unit: r.materialUnit, quantity: 0,
      neededBy: r.pressDate, forRuns: new Map(), growers: new Set(),
    });
    row.quantity += r.materialNeeded;
    if (new Date(r.pressDate) < new Date(row.neededBy)) row.neededBy = r.pressDate;
    // Counted, not repeated: two runs of the same oil listed twice by name
    // reads as a rendering fault rather than as two runs.
    const label = `${r.name} (${r.size})`;
    row.forRuns.set(label, (row.forRuns.get(label) || 0) + 1);
    if (r.grower) row.growers.add(r.growerVillage ? `${r.grower}, ${r.growerVillage}` : r.grower);
  }

  const shoppingList = Object.values(byMaterial)
    .map((r) => ({
      ...r,
      quantity: Math.round(r.quantity * 100) / 100,
      daysAway: daysUntil(r.neededBy),
      growers: [...r.growers],
      forRuns: [...r.forRuns].map(([label, n]) => (n > 1 ? `${n} runs of ${label}` : label)),
    }))
    .sort((a, b) => new Date(a.neededBy) - new Date(b.neededBy));

  // Named so the screen can tell the admin why a run shows no quantity,
  // rather than leaving a blank column to be puzzled over.
  const missingRatio = runs
    .filter((r) => r.materialNeeded == null)
    .map((r) => ({ productId: r.productId, name: r.name, size: r.size }));

  return {
    runs,
    lowStock: runningLow,
    shoppingList,
    missingRatio,
    thresholds: { lowStock: LOW_STOCK_THRESHOLD, forecastDays: FORECAST_WINDOW_DAYS },
  };
}

module.exports = { buildProcurementPlan, LOW_STOCK_THRESHOLD, FORECAST_WINDOW_DAYS };
