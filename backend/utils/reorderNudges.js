const db = require('../data/db');
const { notifyUser } = require('./notify');

const MIN_ORDERS_FOR_PREDICTION = 2; // need at least 2 past orders of the exact item to estimate a personal interval
const MIN_INTERVAL_DAYS = 7; // guards against noise from same-week re-orders
const DUE_FRACTION = 0.9; // nudge slightly before the average interval elapses — delivery itself takes a few days
const DAY_MS = 24 * 60 * 60 * 1000;

function itemKey(item) {
  return `${item.productId}|${item.size}`;
}

/** Per-item order timestamps for one user, oldest first — non-cancelled
 * orders only, since a cancelled order was never actually consumed. */
function buildItemHistory(userOrders) {
  const byItem = new Map();
  const sorted = userOrders.filter((o) => o.status !== 'cancelled').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  for (const order of sorted) {
    for (const item of order.items) {
      const key = itemKey(item);
      if (!byItem.has(key)) byItem.set(key, { name: item.name, size: item.size, timestamps: [] });
      byItem.get(key).timestamps.push(new Date(order.createdAt).getTime());
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

  return { avgIntervalDays, daysSinceLast, overdueRatio: daysSinceLast / avgIntervalDays };
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
    if (userOrders.length < MIN_ORDERS_FOR_PREDICTION) continue;

    const history = buildItemHistory(userOrders);
    let best = null; // the single most-overdue item for this user, if any

    for (const [key, entry] of history) {
      const assessment = assessDueness(entry.timestamps, now);
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
      await notifyUser(user, {
        title: `Running low on ${best.entry.name}?`,
        message: `You usually reorder ${best.entry.name} (${best.entry.size}) every ~${roundedDays} days — looks like you're due. Reorder before you run out?`,
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
