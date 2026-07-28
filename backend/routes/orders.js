const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { signToken } = require('./auth');
const razorpay = require('../utils/razorpay');
const { buildOrderItems, createOrderRecord, notifyAdminOfPaymentSwitch } = require('../utils/orderBuilder');
const { notifyUser } = require('../utils/notify');
const { otpStore } = require('../utils/otpStore');
const { markPhoneVerified, isPhoneVerified, consumePhoneVerification } = require('../utils/phoneVerification');

const CANCELLABLE_STATUSES = ['placed', 'confirmed'];
const RETURN_WINDOW_DAYS = 7;
const RETURN_REASONS = ['damaged-incorrect', 'quality-issue', 'other'];

const router = express.Router();

// Builds a candidate account for a guest checkout — does NOT check for an
// existing phone match or persist it (callers decide when/whether to do
// that; see the two call sites below for why they differ).
async function resolveGuestUser(guestInfo, phone) {
  const name = guestInfo?.name?.trim();
  if (!name || name.length < 2) {
    return { error: { status: 400, message: 'Enter your name.' } };
  }
  if (!phone) {
    return { error: { status: 400, message: 'A phone number is required.' } };
  }
  return {
    user: {
      id: uuid(),
      phone,
      name,
      email: guestInfo?.email?.trim() || '',
      role: 'customer',
      addresses: [],
      createdAt: new Date().toISOString(),
    },
  };
}

// A guest order is only ever attached to a BRAND NEW account — never to an
// existing one, since there's no OTP step to prove the phone number is
// really theirs. Silently reusing an existing account here would let anyone
// view/modify a stranger's order history just by typing their phone number.
async function isPhoneAvailable(phone) {
  const users = await db.list('users');
  return !users.some((u) => u.phone === phone);
}

// POST /api/orders/verify-cod-phone  { phone, otp } — confirms a guest
// actually owns the delivery phone before Cash on Delivery is allowed.
// Reuses the same OTP requested via /api/auth/send-otp; doesn't create or
// touch any user account, just a short-lived proof consumed by POST / below.
router.post('/verify-cod-phone', async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone number and code are required.' });
    }

    const record = otpStore.get(phone);
    if (!record) {
      return res.status(400).json({ success: false, message: 'Please request a new code.' });
    }
    if (Date.now() > record.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ success: false, message: 'Code expired. Please request a new one.' });
    }
    record.attempts += 1;
    if (record.attempts > 5) {
      otpStore.delete(phone);
      return res.status(429).json({ success: false, message: 'Too many attempts. Please request a new code.' });
    }
    if (record.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Incorrect code. Please try again.' });
    }

    otpStore.delete(phone);
    markPhoneVerified(phone);
    res.json({ success: true, message: 'Phone verified.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders  { items, address, paymentMethod, guestInfo? }  — COD path.
// guestInfo: { name, email? } is required when not logged in; the delivery
// address's phone number doubles as the guest's identity.
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { items, address, paymentMethod, couponCode, pointsToRedeem, guestInfo } = req.body;
    const effectivePaymentMethod = paymentMethod || 'cod';

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }
    if (!address || !address.line1 || !address.pincode || !address.phone) {
      return res.status(400).json({ success: false, message: 'A complete delivery address is required.' });
    }

    let userId = req.user?.id;
    let newAccount = null;
    if (!userId) {
      if (!(await isPhoneAvailable(address.phone))) {
        return res.status(409).json({
          success: false,
          message: 'An account already exists with this phone number. Please log in to continue.',
        });
      }
      // Guests are the one checkout path with no account history behind
      // them, so Cash on Delivery — the only payment method with zero cost
      // to a fraudster — requires proving ownership of the delivery phone
      // first (see /verify-cod-phone above). Prepaid orders skip this: a
      // captured payment is itself proof enough.
      if (effectivePaymentMethod === 'cod' && !isPhoneVerified(address.phone)) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your phone number to place a Cash on Delivery order.',
          requiresPhoneVerification: true,
        });
      }
      const resolved = await resolveGuestUser(guestInfo, address.phone);
      if (resolved.error) return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
      newAccount = resolved.user;
      await db.put('users', newAccount);
      userId = newAccount.id;
      if (effectivePaymentMethod === 'cod') consumePhoneVerification(address.phone);
    }

    const { orderItems, total, discount, couponCode: appliedCode, pointsRedeemed, stockError } =
      await buildOrderItems(items, couponCode, address.country, userId, pointsToRedeem);
    if (stockError) return res.status(400).json({ success: false, message: stockError });
    const order = await createOrderRecord({
      userId,
      orderItems,
      address,
      total,
      discount,
      couponCode: appliedCode,
      pointsRedeemed,
      paymentMethod: effectivePaymentMethod,
    });

    const response = { success: true, message: 'Order placed successfully.', order };
    if (newAccount) {
      response.token = signToken(newAccount);
      response.user = newAccount;
    }
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/razorpay/create  { items, guestInfo? } → { razorpayOrderId, amount, currency, keyId }
router.post('/razorpay/create', optionalAuth, async (req, res, next) => {
  try {
    if (!razorpay.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Online payment isn’t set up yet — please choose Cash on Delivery instead.',
      });
    }
    const { items, couponCode, pointsToRedeem, address, guestInfo } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }

    // Guest identity/availability is validated up front, before any payment
    // is initiated — not persisted yet, so an abandoned payment here doesn't
    // leave behind an unused account (see /razorpay/verify, which persists).
    if (!req.user) {
      if (!address?.phone) {
        return res.status(400).json({ success: false, message: 'A complete delivery address is required.' });
      }
      if (!(await isPhoneAvailable(address.phone))) {
        return res.status(409).json({
          success: false,
          message: 'An account already exists with this phone number. Please log in to continue.',
        });
      }
      const resolved = await resolveGuestUser(guestInfo, address.phone);
      if (resolved.error) return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
    }

    const { total, stockError } = await buildOrderItems(items, couponCode, address?.country, req.user?.id, pointsToRedeem);
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
// { items, address, guestInfo?, razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post('/razorpay/verify', optionalAuth, async (req, res, next) => {
  try {
    const { items, address, couponCode, pointsToRedeem, guestInfo, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment confirmation details.' });
    }
    if (!address || !address.line1 || !address.pincode || !address.phone) {
      return res.status(400).json({ success: false, message: 'A complete delivery address is required.' });
    }
    if (!razorpay.verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Please contact support before retrying.' });
    }

    // Same reasoning as the stock check below: /razorpay/create already
    // gated on phone availability before payment was taken, so this doesn't
    // re-check it — rejecting a guest here after Razorpay has already
    // captured the payment would strand a paid customer.
    let userId = req.user?.id;
    let newAccount = null;
    if (!userId) {
      const resolved = await resolveGuestUser(guestInfo, address.phone);
      if (resolved.error) return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
      newAccount = resolved.user;
      await db.put('users', newAccount);
      userId = newAccount.id;
    }

    // No stock re-check here: by this point Razorpay has already captured the
    // payment (verified via signature above), so rejecting on a stock race
    // would strand a paid customer with no order and no refund. The earlier
    // /razorpay/create check is the real gate; any oversell that still slips
    // through this narrow window is visible to the admin in Orders same as
    // a COD one and can be handled manually, same as any other refund case.
    const { orderItems, total, discount, couponCode: appliedCode, pointsRedeemed } =
      await buildOrderItems(items, couponCode, address.country, userId, pointsToRedeem);
    const order = await createOrderRecord({
      userId,
      orderItems,
      address,
      total,
      discount,
      couponCode: appliedCode,
      pointsRedeemed,
      paymentMethod: 'razorpay',
      payment: { razorpay_order_id, razorpay_payment_id },
    });

    const response = { success: true, message: 'Payment verified and order placed.', order };
    if (newAccount) {
      response.token = signToken(newAccount);
      response.user = newAccount;
    }
    res.status(201).json(response);
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
        channels: { inapp: true, email: true, whatsapp: true },
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/pay/create — customer decided to prepay online for an
// order already placed as Cash on Delivery. Same amount as the order itself;
// only allowed while it's still in a cancellable/pre-shipping state.
router.post('/:id/pay/create', requireAuth, async (req, res, next) => {
  try {
    if (!razorpay.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Online payment isn’t set up yet — please continue with Cash on Delivery.',
      });
    }
    const order = await db.get('orders', req.params.id);
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (order.paymentMethod === 'razorpay' || order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'This order is already paid.' });
    }
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `This order can no longer be switched to online payment (current status: ${order.status}).`,
      });
    }

    const rzpOrder = await razorpay.createOrder(order.total, `yo_pay_${order.orderNumber}`);
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

// POST /api/orders/:id/pay/verify  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post('/:id/pay/verify', requireAuth, async (req, res, next) => {
  try {
    const order = await db.get('orders', req.params.id);
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay.verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Please contact support before retrying.' });
    }

    order.paymentMethod = 'razorpay';
    order.paymentStatus = 'paid';
    order.payment = { razorpay_order_id, razorpay_payment_id };
    await db.put('orders', order);

    const user = await db.get('users', order.userId);
    notifyAdminOfPaymentSwitch(order, user);

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
        channels: { inapp: true, email: true, whatsapp: true },
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
