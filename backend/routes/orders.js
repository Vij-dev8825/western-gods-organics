const express = require('express');
const db = require('../data/db');
const { requireAuth } = require('../middleware/auth');
const razorpay = require('../utils/razorpay');
const { buildOrderItems, createOrderRecord } = require('../utils/orderBuilder');
const { notifyUser } = require('../utils/notify');

const CANCELLABLE_STATUSES = ['placed', 'confirmed'];
const RETURN_WINDOW_DAYS = 7;
const RETURN_REASONS = ['damaged-incorrect', 'quality-issue', 'other'];

const router = express.Router();

// POST /api/orders  { items, address, paymentMethod }  — COD path
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { items, address, paymentMethod, couponCode } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }
    if (!address || !address.line1 || !address.pincode || !address.phone) {
      return res.status(400).json({ success: false, message: 'A complete delivery address is required.' });
    }

    const { orderItems, total, discount, couponCode: appliedCode, stockError } = await buildOrderItems(items, couponCode, address.country);
    if (stockError) return res.status(400).json({ success: false, message: stockError });
    const order = await createOrderRecord({
      userId: req.user.id,
      orderItems,
      address,
      total,
      discount,
      couponCode: appliedCode,
      paymentMethod: paymentMethod || 'cod',
    });

    res.status(201).json({ success: true, message: 'Order placed successfully.', order });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/razorpay/create  { items } → { razorpayOrderId, amount, currency, keyId }
router.post('/razorpay/create', requireAuth, async (req, res, next) => {
  try {
    if (!razorpay.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Online payment isn’t set up yet — please choose Cash on Delivery instead.',
      });
    }
    const { items, couponCode, address } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }
    const { total, stockError } = await buildOrderItems(items, couponCode, address?.country);
    if (stockError) return res.status(400).json({ success: false, message: stockError });
    if (total <= 0) {
      return res.status(400).json({ success: false, message: 'Order total must be greater than zero.' });
    }
    const rzpOrder = await razorpay.createOrder(total, `yo_${Date.now()}`);
    res.json({
      success: true,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/razorpay/verify
// { items, address, razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post('/razorpay/verify', requireAuth, async (req, res, next) => {
  try {
    const { items, address, couponCode, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment confirmation details.' });
    }
    if (!address || !address.line1 || !address.pincode || !address.phone) {
      return res.status(400).json({ success: false, message: 'A complete delivery address is required.' });
    }
    if (!razorpay.verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Please contact support before retrying.' });
    }

    // No stock re-check here: by this point Razorpay has already captured the
    // payment (verified via signature above), so rejecting on a stock race
    // would strand a paid customer with no order and no refund. The earlier
    // /razorpay/create check is the real gate; any oversell that still slips
    // through this narrow window is visible to the admin in Orders same as
    // a COD one and can be handled manually, same as any other refund case.
    const { orderItems, total, discount, couponCode: appliedCode } = await buildOrderItems(items, couponCode, address.country);
    const order = await createOrderRecord({
      userId: req.user.id,
      orderItems,
      address,
      total,
      discount,
      couponCode: appliedCode,
      paymentMethod: 'razorpay',
      payment: { razorpay_order_id, razorpay_payment_id },
    });

    res.status(201).json({ success: true, message: 'Payment verified and order placed.', order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders (my orders)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const orders = (await db.list('orders')).filter((o) => o.userId === req.user.id);
    res.json({ success: true, orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const order = await db.get('orders', req.params.id);
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:id/cancel — customer self-service cancellation, only
// while the order hasn't been confirmed for shipping yet.
router.patch('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const order = await db.get('orders', req.params.id);
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `This order can no longer be cancelled (current status: ${order.status}). Please contact support instead.`,
      });
    }

    order.status = 'cancelled';
    await db.put('orders', order);

    const user = await db.get('users', order.userId);
    if (user) {
      await notifyUser(user, {
        title: `Order ${order.orderNumber} cancelled`,
        message:
          order.paymentMethod === 'razorpay'
            ? "Your order has been cancelled. Since it was prepaid, we'll process your refund within 5-7 business days."
            : 'Your order has been cancelled.',
        meta: { orderId: order.id },
        channels: { inapp: true, email: true },
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:id/return  { reason, description } — customer self-service
// return/replacement request, only for delivered orders within the 7-day
// return window (see /refund-policy). Orders delivered before deliveredAt
// started being recorded are let through rather than blocked by a data gap.
router.patch('/:id/return', requireAuth, async (req, res, next) => {
  try {
    const order = await db.get('orders', req.params.id);
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders can have a return requested.' });
    }
    if (order.returnRequest) {
      return res.status(400).json({ success: false, message: 'A return has already been requested for this order.' });
    }
    if (order.deliveredAt) {
      const daysSinceDelivery = (Date.now() - new Date(order.deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
        return res.status(400).json({
          success: false,
          message: 'The 7-day return window for this order has passed. Please contact support instead.',
        });
      }
    }

    const { reason, description } = req.body;
    if (!RETURN_REASONS.includes(reason)) {
      return res.status(400).json({ success: false, message: `Reason must be one of: ${RETURN_REASONS.join(', ')}` });
    }
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Please describe the issue (at least 10 characters).' });
    }

    order.returnRequest = {
      reason,
      description: description.trim().slice(0, 1000),
      status: 'requested',
      createdAt: new Date().toISOString(),
    };
    await db.put('orders', order);

    const user = await db.get('users', order.userId);
    if (user) {
      await notifyUser(user, {
        title: `Return requested for order ${order.orderNumber}`,
        message: "We've received your return request and will review it shortly.",
        meta: { orderId: order.id },
        channels: { inapp: true, email: true },
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
