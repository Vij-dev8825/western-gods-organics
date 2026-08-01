const db = require('../data/db');
const { notifyUser } = require('./notify');

const MIN_ORDERS_FOR_PREDICTION = 2; // need at least 2 past orders of the exact item to estimate a personal interval
const MIN_INTERVAL_DAYS = 7; // guards against noise from same-week re-orders
const DUE_FRACTION = 0.9; // nudge slightly before the average interval elapses — delivery itself takes a few days
const DAY_MS = 24 * 60 * 60 * 1000;

// Cold-start fallback only — used for a customer's very first purchase of an
// item, before there's a second order to derive their own real cadence from.
// A rough household-average consumption rate for oils/powders sold by
// volume/weight; replaced by the empirical per-customer average (above) the
// moment a second order of that exact item exists, so this only ever affects
// the single nudge that gets someone to reorder for the first time.
const ASSUMED_ML_PER_DAY = 10;
const ASSUMED_G_PER_DAY = 10;

function itemKey(item) {
  return `${item.productId}|${item.size}`;
}

function parseSizeLabel(label) {
  const match = String(label || '').trim().match(/^([\d.]+)\s*(ml|l|g|kg)\b/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'l') return { quantity: value * 1000, unit: 'ml' };
  if (unit === 'kg') return { quantity: value * 1000, unit: 'g' };
  return { quantity: value, unit };
}

/** Estimated days a purchased quantity of this size should last, at the
 * assumed household rate — null for sizes that aren't a recognizable
 * volume/weight (e.g. "Combo Pack"), which just never get a cold-start nudge. */
function estimatedDaysForSize(size, quantity) {
  const parsed = parseSizeLabel(size);
  if (!parsed) return null;
  const perDay = parsed.unit === 'ml' ? ASSUMED_ML_PER_DAY : ASSUMED_G_PER_DAY;
  return (parsed.quantity * quantity) / perDay;
}

/** Per-item order history for one user, oldest first — non-cancelled orders
 * only, since a cancelled order was never actually consumed. */
function buildItemHistory(userOrders) {
  const byItem = new Map();
  const sorted = userOrders.filter((o) => o.status !== 'cancelled').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  for (const order of sorted) {
    for (const item of order.items) {
      const key = itemKey(item);
      if (!byItem.has(key)) byItem.set(key, { name: item.name, size: item.size, timestamps: [], lastQuantity: 0 });
      const entry = byItem.get(key);
      entry.timestamps.push(new Date(order.createdAt).getTime());
      entry.lastQuantity = item.quantity;
    }
  }
  return byItem;
}

/** For a set of order timestamps, returns how "due" this item is right now
 * relative to the customer's own average reorder interval — null if there
 * isn't enough history, or the pattern is too frequent to be meaningful. */
function assessDueness(timestamps, now) {
  if (timestamps.length < MIN_ORDERS_FOR_PREDICTION) return null;
  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) intervals.push((timestamps[i] - timestamps[i - 1]) / DAY_MS);
  const avgIntervalDays = intervals.reduce((sum, d) => sum + d, 0) / intervals.length;
  if (avgIntervalDays < MIN_INTERVAL_DAYS) return null;

  const daysSinceLast = (now - timestamps[timestamps.length - 1]) / DAY_MS;
  const dueThresholdDays = avgIntervalDays * DUE_FRACTION;
  if (daysSinceLast < dueThresholdDays) return null;

  return { avgIntervalDays, daysSinceLast, overdueRatio: daysSinceLast / avgIntervalDays, isEstimate: false };
}

/** Cold-start version of assessDueness — only for an item bought exactly
 * once, where there's no second order yet to derive a real interval from.
 * Uses the assumed household consumption rate instead, so a first-time
 * buyer can still get one nudge prompting them to reorder at all. */
function assessDuenessFallback(entry, now) {
  if (entry.timestamps.length !== 1) return null; // 2+ orders use the empirical estimate above instead
  const estimatedDays = estimatedDaysForSize(entry.size, entry.lastQuantity);
  if (!estimatedDays || estimatedDays < MIN_INTERVAL_DAYS) return null;

  const daysSinceLast = (now - entry.timestamps[0]) / DAY_MS;
  const dueThresholdDays = estimatedDays * DUE_FRACTION;
  if (daysSinceLast < dueThresholdDays) return null;

  return { avgIntervalDays: estimatedDays, daysSinceLast, overdueRatio: daysSinceLast / estimatedDays, isEstimate: true };
}

/** Predicts, per customer, which past-purchased item they're likely running
 * low on — based on their OWN reorder cadence for that exact product+size,
 * not a generic "you haven't ordered in a while" reminder — and sends at
 * most one nudge per customer per run so it reads as a considered heads-up,
 * not a barrage. Runs on a plain setInterval from server.js, same pattern
 * as processAbandonedCarts/processDueSubscriptions. */
async function processReorderNudges() {
  const [orders, users] = await Promise.all([db.list('orders'), db.list('users')]);
  const ordersByUser = new Map();
  for (const o of orders) {
    if (!ordersByUser.has(o.userId)) ordersByUser.set(o.userId, []);
    ordersByUser.get(o.userId).push(o);
  }

  const now = Date.now();
  const results = [];

  for (const user of users) {
    const userOrders = ordersByUser.get(user.id) || [];
    if (userOrders.length < 1) continue;

    const history = buildItemHistory(userOrders);
    let best = null; // the single most-overdue item for this user, if any

    for (const [key, entry] of history) {
      // Empirical (2+ orders of this exact item) takes priority over the
      // cold-start size-based estimate whenever both would apply.
      const assessment = assessDueness(entry.timestamps, now) || assessDuenessFallback(entry, now);
      if (!assessment) continue;

      const lastNudgedAt = user.reorderNudgeLog?.[key];
      if (lastNudgedAt && now - new Date(lastNudgedAt).getTime() < assessment.avgIntervalDays * DAY_MS) continue;

      if (!best || assessment.overdueRatio > best.assessment.overdueRatio) {
        best = { key, entry, assessment };
      }
    }

    if (!best) continue;

    try {
      const roundedDays = Math.round(best.assessment.avgIntervalDays);
      const message = best.assessment.isEstimate
        ? `Based on typical usage, you might be running low on ${best.entry.name} (${best.entry.size}) — want to reorder?`
        : `You usually reorder ${best.entry.name} (${best.entry.size}) every ~${roundedDays} days — looks like you're due. Reorder before you run out?`;
      await notifyUser(user, {
        title: `Running low on ${best.entry.name}?`,
        message,
        meta: { productId: best.key.split('|')[0] },
        channels: { inapp: true, email: true, whatsapp: true },
      });

      user.reorderNudgeLog = { ...(user.reorderNudgeLog || {}), [best.key]: new Date(now).toISOString() };
      await db.put('users', user);
      results.push({ userId: user.id, item: best.key, nudged: true });
    } catch (err) {
      results.push({ userId: user.id, error: err.message });
    }
  }

  return results;
}

module.exports = { processReorderNudges };
