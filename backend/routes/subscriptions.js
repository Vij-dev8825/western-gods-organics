const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth } = require('../middleware/auth');
const { DISCOUNT_PERCENT, isValidFrequencyDays, MIN_FREQUENCY_DAYS, MAX_FREQUENCY_DAYS, computeNextDate } = require('../utils/subscriptions');

const router = express.Router();

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
    if (!product.sizes.some((s) => s.label === size)) {
      return res.status(400).json({ success: false, message: 'That size is not available for this product.' });
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
    await db.put('subscriptions', subscription);
    res.json({ success: true, subscription });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
