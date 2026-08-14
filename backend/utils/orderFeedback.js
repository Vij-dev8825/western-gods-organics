/**
 * Asking the customer how it went, privately, and telling the shop when it
 * didn't go well.
 *
 * The site already asks for a public review a week after delivery. That is the
 * right thing to ask for, and the wrong only thing to ask for: a customer whose
 * bottle arrived leaking has nowhere to say so except the product page, which
 * means the shop finds out about the problem at the same moment every future
 * shopper does. A mill with one review cannot afford to learn that way.
 *
 * So the message that already goes out the day after delivery — which until now
 * only pointed at the usage guides and asked nothing — now asks a single
 * question, answerable in one tap from WhatsApp with nothing to log into.
 *
 * It does NOT decide who gets asked for a public review based on the answer.
 * Filtering the review request by score is review-gating: it is dishonest, it
 * is against Google's and the FTC's rules, and a shop that only shows the
 * happy half of its customers eventually gets found out. Everyone still gets
 * the same seven-day invitation. This is for fixing things, not for hiding them.
 */
const crypto = require('crypto');
const db = require('./../data/db');

// Below this, somebody at the mill needs to read it and probably ring back.
const NEEDS_ATTENTION_AT_OR_BELOW = 3;

const ISSUES = {
  damaged: 'Arrived damaged or leaking',
  late: 'Took too long to arrive',
  wrong: 'Wrong item or size',
  missing: 'Something was missing',
  quality: 'Not happy with the product',
  packaging: 'Packaging could be better',
};

/** Unguessable, and not derived from the order id — the link travels over
 *  WhatsApp and opens with no login, so it must not be possible to walk it to
 *  another customer's order by editing a digit. */
const newToken = () => crypto.randomBytes(24).toString('base64url');

/** Mints and stores a token on the order, reusing one already there so a
 *  resent message points at the same form. */
async function ensureFeedbackToken(order) {
  if (order.feedbackToken) return order.feedbackToken;
  order.feedbackToken = newToken();
  await db.put('orders', order);
  return order.feedbackToken;
}

async function findOrderByToken(token) {
  if (!token || typeof token !== 'string' || token.length < 16) return null;
  const orders = await db.list('orders');
  return orders.find((o) => o.feedbackToken === token) || null;
}

async function getFeedbackForOrder(orderId) {
  const all = await db.list('order-feedback');
  return all.find((f) => f.orderId === orderId) || null;
}

/**
 * Records an answer. One per order — a second submission edits the first
 * rather than stacking up, since the link stays live and people re-open
 * things they have already filled in.
 */
async function saveFeedback(order, { rating, issues, comment }) {
  const score = Math.round(Number(rating) || 0);
  if (score < 1 || score > 5) {
    return { error: 'Choose a rating from 1 to 5.' };
  }
  const picked = (Array.isArray(issues) ? issues : []).filter((i) => ISSUES[i]);

  const existing = await getFeedbackForOrder(order.id);
  const record = {
    id: existing?.id || crypto.randomUUID(),
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId || null,
    customerName: order.address?.name || '',
    customerPhone: order.address?.phone || '',
    rating: score,
    issues: picked,
    comment: String(comment || '').slice(0, 1000),
    needsAttention: score <= NEEDS_ATTENTION_AT_OR_BELOW || picked.length > 0,
    handledAt: existing?.handledAt || null,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.put('order-feedback', record);
  return { feedback: record };
}

/** Newest first, with the ones needing a person floated to the top. */
async function listFeedback() {
  const all = await db.list('order-feedback');
  return all.sort((a, b) => {
    const openA = a.needsAttention && !a.handledAt;
    const openB = b.needsAttention && !b.handledAt;
    if (openA !== openB) return openA ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

/** Everything still waiting on someone — what the Today screen shows. */
async function openFeedback() {
  return (await listFeedback()).filter((f) => f.needsAttention && !f.handledAt);
}

async function markHandled(id) {
  const record = await db.get('order-feedback', id);
  if (!record) return null;
  record.handledAt = new Date().toISOString();
  await db.put('order-feedback', record);
  return record;
}

/** Average and count, for the admin header. Excludes nothing — a summary that
 *  quietly drops the bad ones is worse than no summary. */
async function feedbackSummary() {
  const all = await db.list('order-feedback');
  if (all.length === 0) return { count: 0, average: null, open: 0 };
  const total = all.reduce((sum, f) => sum + (Number(f.rating) || 0), 0);
  return {
    count: all.length,
    average: Math.round((total / all.length) * 10) / 10,
    open: all.filter((f) => f.needsAttention && !f.handledAt).length,
  };
}

module.exports = {
  ISSUES,
  NEEDS_ATTENTION_AT_OR_BELOW,
  ensureFeedbackToken,
  findOrderByToken,
  getFeedbackForOrder,
  saveFeedback,
  listFeedback,
  openFeedback,
  markHandled,
  feedbackSummary,
};
