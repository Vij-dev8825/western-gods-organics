const express = require('express');
const db = require('../data/db');
const razorpay = require('../utils/razorpay');
const { renewSubscription } = require('../utils/subscriptions');

const router = express.Router();

// POST /api/webhooks/razorpay — configure this URL in the Razorpay
// Dashboard's Settings → Webhooks, subscribed to "subscription.charged",
// with a secret matching RAZORPAY_WEBHOOK_SECRET (a DIFFERENT secret from
// the RAZORPAY_KEY_ID/SECRET pair used elsewhere — Razorpay generates it
// specifically for the webhook when you set one up).
router.post('/razorpay', async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!razorpay.verifyWebhookSignature(req.rawBody, signature)) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const event = req.body;
    if (event.event === 'subscription.charged') {
      const rzpSubscriptionId = event.payload?.subscription?.entity?.id;
      const rzpPaymentId = event.payload?.payment?.entity?.id;

      const subs = await db.list('subscriptions');
      const sub = subs.find((s) => s.razorpaySubscriptionId === rzpSubscriptionId);

      if (sub && sub.status === 'active') {
        // Razorpay delivers webhooks at-least-once and retries on anything
        // but a fast 2xx — guard against creating a duplicate renewal order
        // if the same charge event arrives twice.
        const orders = await db.list('orders');
        const alreadyProcessed = orders.some((o) => o.payment?.razorpay_payment_id === rzpPaymentId);
        if (!alreadyProcessed) {
          await renewSubscription(sub, {
            paymentMethod: 'razorpay',
            payment: { razorpay_subscription_id: rzpSubscriptionId, razorpay_payment_id: rzpPaymentId },
          });
        }
      }
    }

    // Any other event type is acknowledged but ignored — Razorpay only
    // needs a 2xx to consider the webhook delivered.
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
