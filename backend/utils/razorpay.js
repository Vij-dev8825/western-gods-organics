const crypto = require('crypto');

/**
 * Thin wrapper over Razorpay's REST API (no SDK dependency, same pattern as
 * the MSG91/Twilio helpers). Requires RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET.
 * Test-mode keys (from the Razorpay dashboard, no KYC needed) work exactly
 * the same as live keys for all of this — only real settlement requires
 * completed KYC on Razorpay's side.
 */

function isConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function authHeader() {
  const token = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  return `Basic ${token}`;
}

/** amountRupees: number (e.g. 770); returns the Razorpay order object. */
async function createOrder(amountRupees, receipt) {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      amount: Math.round(amountRupees * 100), // paise
      currency: 'INR',
      receipt,
      payment_capture: 1,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.description || `Razorpay order creation failed (${res.status})`);
  return data;
}

/** Verifies the HMAC signature Razorpay's checkout returns after payment. */
function verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature || ''));
  } catch {
    return false; // length mismatch etc. — treat as invalid, not a crash
  }
}

/**
 * UPI Autopay (Subscribe & Save) uses Razorpay's separate Subscriptions API
 * — a Plan (fixed amount + billing period) backing a Subscription (the
 * actual recurring mandate a customer authorizes). Unlike the one-off Orders
 * API above, the amount is locked in at the plan's creation — a product
 * price change later does NOT retroactively change what an already-enrolled
 * customer is charged (a Razorpay/most payment-mandate constraint, not a
 * bug here); re-enrolling is required to pick up a new price.
 */

/** period: 'daily' | 'weekly' | 'monthly' | 'yearly'; interval: billing
 * every `interval` periods (e.g. period='daily', interval=28 → every 28
 * days) — this is how an arbitrary day-count frequency maps onto Razorpay's
 * period+interval model. amountRupees is the full per-cycle charge. */
async function createPlan({ amountRupees, period, interval, name }) {
  const res = await fetch('https://api.razorpay.com/v1/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      period,
      interval,
      item: { name, amount: Math.round(amountRupees * 100), currency: 'INR' },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.description || `Razorpay plan creation failed (${res.status})`);
  return data;
}

/** totalCount: number of cycles Razorpay will attempt before the mandate
 * expires — Razorpay requires a finite count, so a large number (~120
 * cycles) stands in for "until the customer cancels". */
async function createSubscription({ planId, totalCount, notes }) {
  const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      plan_id: planId,
      total_count: totalCount,
      customer_notify: 1,
      notes: notes || {},
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.description || `Razorpay subscription creation failed (${res.status})`);
  return data;
}

async function cancelSubscription(subscriptionId) {
  const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({ cancel_at_cycle_end: 0 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.description || `Razorpay subscription cancellation failed (${res.status})`);
  return data;
}

/** Verifies the checkout signature for a subscription's first payment. Note
 * the field order is payment_id THEN subscription_id — the reverse of
 * verifySignature's order_id-then-payment_id above, per Razorpay's own
 * (differing) contract for this flow. Easy to get backwards; don't. */
function verifySubscriptionSignature({ razorpay_payment_id, razorpay_subscription_id, razorpay_signature }) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature || ''));
  } catch {
    return false;
  }
}

function webhookConfigured() {
  return !!process.env.RAZORPAY_WEBHOOK_SECRET;
}

/** Verifies X-Razorpay-Signature on an incoming webhook — an HMAC of the
 * RAW request body (not the re-serialized JSON, which can differ byte-for-
 * byte) using a separate webhook secret set in the Razorpay Dashboard's
 * Webhooks page, distinct from the API key secret above. */
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!webhookConfigured() || !signatureHeader) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

module.exports = {
  isConfigured,
  createOrder,
  verifySignature,
  createPlan,
  createSubscription,
  cancelSubscription,
  verifySubscriptionSignature,
  webhookConfigured,
  verifyWebhookSignature,
};
