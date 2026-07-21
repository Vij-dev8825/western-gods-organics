const express = require('express');
const db = require('../data/db');
const { requireAuth } = require('../middleware/auth');
const razorpay = require('../utils/razorpay');
const { buildOrderItems, createOrderRecord } = require('../utils/orderBuilder');
const { notifyUser } = require('../utils/notify');

const CANCELLABLE_STATUSES = ['placed', 'confirmed'];

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

    const { orderItems, total, discount, couponCode: appliedCode } = await buildOrderItems(items, couponCode);
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
    const { items, couponCode } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }
    const { total } = await buildOrderItems(items, couponCode);
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

    const { orderItems, total, discount, couponCode: appliedCode } = await buildOrderItems(items, couponCode);
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

module.exports = router;
