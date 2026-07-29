const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth } = require('../middleware/auth');
const {
  DISCOUNT_PERCENT,
  isValidFrequencyDays,
  MIN_FREQUENCY_DAYS,
  MAX_FREQUENCY_DAYS,
  computeNextDate,
  computeRenewalAmount,
} = require('../utils/subscriptions');
const razorpay = require('../utils/razorpay');

const router = express.Router();

// Razorpay's Plan model bills every `interval` `period`s — 'daily' with
// interval=frequencyDays covers this app's full 7-180 day range in one unit.
const AUTOPAY_TOTAL_COUNT = 120; // ~cycles before the mandate would need renewing; stands in for "until cancelled"

// GET /api/subscriptions (mine)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const subscriptions = (await db.list('subscriptions')).filter((s) => s.userId === req.user.id);
    res.json({ success: true, subscriptions, discountPercent: DISCOUNT_PERCENT });
  } catch (err) {
    next(err);
  }
});

// POST /api/subscriptions  { productId, size, quantity, frequencyDays, address }
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { productId, size, quantity, frequencyDays, address } = req.body;
    if (!productId || !size) {
      return res.status(400).json({ success: false, message: 'Product and size are required.' });
    }
    if (!isValidFrequencyDays(Number(frequencyDays))) {
      return res.status(400).json({
        success: false,
        message: `Choose a delivery frequency between ${MIN_FREQUENCY_DAYS} and ${MAX_FREQUENCY_DAYS} days.`,
      });
    }
    if (!address || !address.line1 || !address.pincode || !address.phone) {
      return res.status(400).json({ success: false, message: 'A complete delivery address is required.' });
    }
    const product = await db.get('products', productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    const sizeInfo = product.sizes.find((s) => s.label === size);
    if (!sizeInfo) {
      return res.status(400).json({ success: false, message: 'That size is not available for this product.' });
    }
    if (sizeInfo.stock <= 0) {
      return res.status(400).json({ success: false, message: 'That size is currently out of stock.' });
    }

    const subscription = {
      id: uuid(),
      userId: req.user.id,
      productId,
      productName: product.name,
      size,
      quantity: Number(quantity) > 0 ? Number(quantity) : 1,
      frequencyDays: Number(frequencyDays),
      discountPercent: DISCOUNT_PERCENT,
      address,
      status: 'active',
      nextOrderDate: computeNextDate(new Date().toISOString(), Number(frequencyDays)),
      lastOrderId: null,
      createdAt: new Date().toISOString(),
    };
    await db.put('subscriptions', subscription);
    res.status(201).json({ success: true, subscription });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/subscriptions/:id  { status?, quantity?, frequencyDays? }
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const subscription = await db.get('subscriptions', req.params.id);
    if (!subscription || subscription.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }
    if (req.body.status && ['active', 'paused', 'cancelled'].includes(req.body.status)) {
      subscription.status = req.body.status;
    }
    if (req.body.quantity && Number(req.body.quantity) > 0) {
      subscription.quantity = Number(req.body.quantity);
    }
    if (req.body.frequencyDays && isValidFrequencyDays(Number(req.body.frequencyDays))) {
      subscription.frequencyDays = Number(req.body.frequencyDays);
    }

    // Stop Razorpay from attempting further charges once the local
    // subscription is no longer active — otherwise the mandate would keep
    // billing a subscription the customer just paused/cancelled here.
    if (subscription.autopayEnabled && req.body.status && req.body.status !== 'active') {
      await razorpay.cancelSubscription(subscription.razorpaySubscriptionId).catch(() => {});
      subscription.autopayEnabled = false;
    }

    await db.put('subscriptions', subscription);
    res.json({ success: true, subscription });
  } catch (err) {
    next(err);
  }
});

// POST /api/subscriptions/:id/autopay/create → { razorpaySubscriptionId, keyId, amount }
// Computes the current per-cycle price, creates a matching Razorpay Plan +
// Subscription, and returns what the frontend needs to open Razorpay
// Checkout in subscription mode (subscription_id, not order_id/amount).
router.post('/:id/autopay/create', requireAuth, async (req, res, next) => {
  try {
    if (!razorpay.isConfigured()) {
      return res.status(503).json({ success: false, message: 'Online payment isn’t set up yet.' });
    }
    const subscription = await db.get('subscriptions', req.params.id);
    if (!subscription || subscription.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }
    if (subscription.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Only an active subscription can enable UPI Autopay.' });
    }
    if (subscription.autopayEnabled) {
      return res.status(400).json({ success: false, message: 'UPI Autopay is already enabled for this subscription.' });
    }

    const computed = await computeRenewalAmount(subscription);
    if (computed.error) return res.status(400).json({ success: false, message: computed.error });

    const plan = await razorpay.createPlan({
      amountRupees: computed.total,
      period: 'daily',
      interval: subscription.frequencyDays,
      name: `${subscription.productName} (${subscription.size}) — Subscribe & Save`,
    });
    const rzpSubscription = await razorpay.createSubscription({
      planId: plan.id,
      totalCount: AUTOPAY_TOTAL_COUNT,
      notes: { localSubscriptionId: subscription.id },
    });

    // Not marked autopayEnabled yet — only /autopay/verify does that, once
    // the mandate is actually confirmed by a valid checkout signature.
    subscription.razorpayPlanId = plan.id;
    subscription.razorpaySubscriptionId = rzpSubscription.id;
    await db.put('subscriptions', subscription);

    res.json({
      success: true,
      razorpaySubscriptionId: rzpSubscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: computed.total,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/subscriptions/:id/autopay/verify  { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
router.post('/:id/autopay/verify', requireAuth, async (req, res, next) => {
  try {
    const subscription = await db.get('subscriptions', req.params.id);
    if (!subscription || subscription.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Subscription not found.' });
    }
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;
    if (!razorpay.verifySubscriptionSignature({ razorpay_payment_id, razorpay_subscription_id, razorpay_signature })) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Please contact support before retrying.' });
    }
    if (subscription.razorpaySubscriptionId !== razorpay_subscription_id) {
      return res.status(400).json({ success: false, message: 'Subscription mismatch. Please try again.' });
    }

    subscription.autopayEnabled = true;
    await db.put('subscriptions', subscription);
    res.json({ success: true, subscription });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
