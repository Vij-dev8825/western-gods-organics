/**
 * What a customer is worth, and whether we are losing them.
 *
 * The admin already listed who has an account. This works out who matters:
 * what they have spent, how often, how long since they last did, and which
 * segment that puts them in — so a broadcast can go to the two hundred people
 * worth reaching rather than to everyone, every time.
 *
 * Everything is derived from the orders themselves rather than stored on the
 * user. A denormalised lifetime-value column is a number that silently goes
 * wrong the first time an order is refunded or edited, and this catalogue is
 * small enough that recomputing costs nothing.
 */

/* A cancelled order is not revenue, and counting it would overstate both the
 * customer's value and the shop's. Everything else is money that was agreed —
 * including cash on delivery not yet collected, which is most of this shop's
 * book and would otherwise read as almost no sales at all. */
const COUNTS_AS_REVENUE = (order) => order.status !== 'cancelled';

/* Days of silence before a customer is drifting, and before they are gone.
 * Pitched for a pantry staple: a household buying cooking oil reorders on
 * something like a monthly-to-quarterly rhythm, so sixty days quiet is a
 * wobble and a hundred and twenty is a customer who has found another mill. */
const LAPSING_AFTER_DAYS = 60;
const LAPSED_AFTER_DAYS = 120;

/* Top spenders, by share rather than by a fixed rupee figure — a hardcoded
 * threshold either catches everybody or nobody as the shop grows. */
const VIP_TOP_FRACTION = 0.1;

const DAY = 24 * 60 * 60 * 1000;

function daysBetween(then, now) {
  if (!then) return null;
  const t = new Date(then).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / DAY);
}

/**
 * @param {object[]} users   non-admin user records
 * @param {object[]} orders  every order
 * @param {number} [now]     injectable clock, so tests are not time-dependent
 * @returns {object[]} one row per user, with stats and a segment
 */
function buildCustomerStats(users, orders, now = Date.now()) {
  const byUser = new Map();
  for (const order of orders) {
    if (!order.userId || !COUNTS_AS_REVENUE(order)) continue;
    if (!byUser.has(order.userId)) byUser.set(order.userId, []);
    byUser.get(order.userId).push(order);
  }

  const rows = users.map((user) => {
    const own = (byUser.get(user.id) || []).sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    const lifetimeValue = own.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const firstOrderAt = own.length ? own[0].createdAt : null;
    const lastOrderAt = own.length ? own[own.length - 1].createdAt : null;
    const daysSinceLastOrder = daysBetween(lastOrderAt, now);

    let status;
    if (!own.length) status = 'never';
    else if (daysSinceLastOrder >= LAPSED_AFTER_DAYS) status = 'lapsed';
    else if (daysSinceLastOrder >= LAPSING_AFTER_DAYS) status = 'lapsing';
    else status = 'active';

    return {
      id: user.id,
      name: user.name || '',
      phone: user.phone || '',
      email: user.email || '',
      createdAt: user.createdAt || null,
      isWholesale: !!user.isWholesale,
      isAffiliate: !!user.isAffiliate,
      affiliateCode: user.affiliateCode || null,
      commissionRate: user.commissionRate || 0,
      note: user.crmNote || '',
      orderCount: own.length,
      lifetimeValue: Math.round(lifetimeValue),
      avgOrderValue: own.length ? Math.round(lifetimeValue / own.length) : 0,
      firstOrderAt,
      lastOrderAt,
      daysSinceLastOrder,
      status,
      isVip: false, // filled in below, once every row's value is known
    };
  });

  /* VIP is relative, so it can only be decided after every row exists. Ranked
   * among customers who have actually bought something — a tenth of the whole
   * list, most of whom have never ordered, would be a threshold of zero. */
  const buyers = rows.filter((r) => r.orderCount > 0).sort((a, b) => b.lifetimeValue - a.lifetimeValue);
  const vipCount = Math.max(1, Math.ceil(buyers.length * VIP_TOP_FRACTION));
  const vipIds = new Set(buyers.slice(0, vipCount).map((r) => r.id));
  for (const row of rows) row.isVip = vipIds.has(row.id) && row.orderCount > 0;

  return rows;
}

/**
 * Who a broadcast goes to. Each is a question worth asking of a shop this
 * size, and each maps to something you would actually say to those people.
 */
const SEGMENTS = {
  all: { label: 'Everyone', test: () => true },
  active: {
    label: 'Active — ordered in the last 60 days',
    test: (c) => c.status === 'active',
  },
  lapsing: {
    label: 'Slipping away — 60 to 120 days quiet',
    test: (c) => c.status === 'lapsing',
  },
  lapsed: {
    label: 'Lapsed — over 120 days quiet',
    test: (c) => c.status === 'lapsed',
  },
  'never-ordered': {
    label: 'Signed up, never ordered',
    test: (c) => c.status === 'never',
  },
  vip: {
    label: 'Top 10% by lifetime spend',
    test: (c) => c.isVip,
  },
  wholesale: {
    label: 'Wholesale accounts',
    test: (c) => c.isWholesale,
  },
  repeat: {
    label: 'Bought more than once',
    test: (c) => c.orderCount > 1,
  },
};

function isSegment(key) {
  return Object.prototype.hasOwnProperty.call(SEGMENTS, key);
}

/** Rows in one segment. An unknown key returns everyone rather than nobody:
 * a broadcast silently reaching zero people is the worse failure, and the
 * route validates the key before it gets here anyway. */
function filterBySegment(rows, key) {
  const segment = SEGMENTS[key];
  return segment ? rows.filter(segment.test) : rows;
}

/** How many people each segment currently holds, for the picker to show
 * before anything is sent. */
function segmentCounts(rows) {
  return Object.entries(SEGMENTS).map(([key, { label }]) => ({
    key,
    label,
    count: rows.filter(SEGMENTS[key].test).length,
  }));
}

module.exports = {
  buildCustomerStats,
  filterBySegment,
  segmentCounts,
  isSegment,
  SEGMENTS,
  LAPSING_AFTER_DAYS,
  LAPSED_AFTER_DAYS,
};
