const express = require('express');
const db = require('../data/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { signToken } = require('./auth');
const razorpay = require('../utils/razorpay');
const {
  buildOrderItems,
  createOrderRecord,
  notifyAdminOfPaymentSwitch,
  notifyAdminOfBottleReturn,
  COD_ADVANCE_INR,
} = require('../utils/orderBuilder');
const { notifyUser } = require('../utils/notify');
const { otpStore } = require('../utils/otpStore');
const { markPhoneVerified, isPhoneVerified, consumePhoneVerification } = require('../utils/phoneVerification');
const { getPaymentMethodsConfig } = require('../utils/paymentMethods');
// Shared with the counter-order route in routes/admin.js, so an order taken
// over the phone resolves to the same account a checkout would.
const { findUserByPhone, resolveGuestUser, syncContactDetails } = require('../utils/customers');
const { ensureFeedbackToken } = require('../utils/orderFeedback');
const { restoreStockForOrder } = require('../utils/stock');

const CANCELLABLE_STATUSES = ['placed', 'confirmed'];
const RETURN_WINDOW_DAYS = 7;
const RETURN_REASONS = ['damaged-incorrect', 'quality-issue', 'other'];

const router = express.Router();

/**
 * Decides which account a not-logged-in checkout belongs to.
 *
 * A returning customer typing the phone number already on their account used
 * to be rejected outright and sent to the login page, losing the checkout.
 * They're now let through — but only once an OTP proves the number is really
 * theirs, because this same request hands back a login token. Skipping that
 * proof would let anyone check out with a stranger's phone number and be
 * signed in as them, with their order history, addresses and points.
 *
 * Returns one of:
 *   { user, isExisting, noToken? } — go ahead (new account not yet persisted)
 *   { needsVerification: true }    — right phone, no proof yet; ask for the OTP
 *   { error }                      — bad/missing details
 */
async function resolveCheckoutUser(guestInfo, phone, { requireVerifiedForNew }) {
  if (!phone) return { error: { status: 400, message: 'A phone number is required.' } };

  const existing = await findUserByPhone(phone);
  if (existing) {
    if (!isPhoneVerified(phone)) return { needsVerification: true };
    // The shop's own number can buy from the shop — the order is placed
    // against that account like anyone else's. What it doesn't get is the
    // login token this route hands back: that would turn a checkout OTP into
    // a full admin session, escalating a weaker proof into the strongest
    // possible one. Admins sign in through the admin login instead.
    return { user: existing, isExisting: true, noToken: existing.role === 'admin' };
  }

  // Brand-new account. Cash on Delivery is the one method with no cost to a
  // fraudster, so it still needs the phone proven; a captured prepayment is
  // proof enough on its own.
  if (requireVerifiedForNew && !isPhoneVerified(phone)) return { needsVerification: true };

  const resolved = await resolveGuestUser(guestInfo, phone);
  if (resolved.error) return { error: resolved.error };
  return { user: resolved.user, isExisting: false };
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
    const { items, address, paymentMethod, couponCode, pointsToRedeem, guestInfo, giftCardCode, isGift, giftMessage, affiliateCode } = req.body;
    const effectivePaymentMethod = paymentMethod || 'cod';
    const shippingChoice = req.body.shippingChoice === 'to_pay' ? 'to_pay' : 'shipping';

    if (effectivePaymentMethod === 'cod' && !(await getPaymentMethodsConfig()).cod) {
      return res.status(400).json({ success: false, message: 'Cash on Delivery is currently unavailable — please choose another payment method.' });
    }
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }
    if (!address || !address.line1 || !address.pincode || !address.phone) {
      return res.status(400).json({ success: false, message: 'A complete delivery address is required.' });
    }

    let userId = req.user?.id;
    let newAccount = null;
    let returningUser = null;
    if (!userId) {
      const resolved = await resolveCheckoutUser(guestInfo, address.phone, {
        requireVerifiedForNew: effectivePaymentMethod === 'cod',
      });
      if (resolved.error) return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
      if (resolved.needsVerification) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your phone number to place this order.',
          requiresPhoneVerification: true,
        });
      }
      if (!resolved.isExisting) {
        newAccount = resolved.user;
        await db.put('users', newAccount);
      }
      userId = resolved.user.id;
      // Signing an existing customer in off the back of their OTP is the
      // same proof the login route uses, so hand back a token either way.
      if (resolved.isExisting && !resolved.noToken) returningUser = resolved.user;
      consumePhoneVerification(address.phone);
    }
    // A brand-new guest account was just built from these exact details, so
    // there's nothing to write back there. This covers the two cases that
    // reach an already-existing account: a signed-in customer, and a
    // returning one whose OTP just proved the number is theirs.
    if (!newAccount) await syncContactDetails(userId, guestInfo);

    const { orderItems, total, discount, couponCode: appliedCode, prepaidDiscount, pointsRedeemed, giftCardCode: appliedGiftCardCode, giftCardApplied, stockError } =
      await buildOrderItems(items, couponCode, address.country, userId, pointsToRedeem, shippingChoice, giftCardCode, effectivePaymentMethod, address.pincode);
    if (stockError) return res.status(400).json({ success: false, message: stockError });
    const order = await createOrderRecord({
      userId,
      orderItems,
      address,
      total,
      discount,
      couponCode: appliedCode,
      prepaidDiscount,
      pointsRedeemed,
      paymentMethod: effectivePaymentMethod,
      shippingChoice,
      giftCardCode: appliedGiftCardCode,
      giftCardApplied,
      isGift,
      giftMessage,
      affiliateCode,
    });

    const response = { success: true, message: 'Order placed successfully.', order };
    // Both cases got here by proving the phone via OTP (see
    // resolveCheckoutUser), so both are safe to sign in. An admin checking out
    // is deliberately not among them — the order is placed, but no token.
    const signInAs = newAccount || returningUser;
    if (signInAs) {
      response.token = signToken(signInAs);
      response.user = signInAs;
    }
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/razorpay/create  { items, guestInfo? } → { razorpayOrderId, amount, currency, keyId }
router.post('/razorpay/create', optionalAuth, async (req, res, next) => {
  try {
    if (!razorpay.isConfigured() || !(await getPaymentMethodsConfig()).razorpay) {
      return res.status(503).json({
        success: false,
        message: 'Online payment isn’t set up yet — please choose Cash on Delivery instead.',
      });
    }
    const { items, couponCode, pointsToRedeem, address, guestInfo, giftCardCode } = req.body;
    const shippingChoice = req.body.shippingChoice === 'to_pay' ? 'to_pay' : 'shipping';
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
      // Pre-flight only — nothing is created here. Gating an existing-phone
      // checkout now (rather than after payment) means a returning customer
      // is asked for their OTP before any money moves, and /razorpay/verify
      // below never has to reject an already-paid order.
      const resolved = await resolveCheckoutUser(guestInfo, address.phone, { requireVerifiedForNew: false });
      if (resolved.error) return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
      if (resolved.needsVerification) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your phone number to continue.',
          requiresPhoneVerification: true,
        });
      }
    }

    // Must thread giftCardCode the same way as /razorpay/verify below — this
    // is the amount Razorpay actually charges, so it has to already reflect
    // whatever the gift card knocks off, or verify's independently recomputed
    // total (which does) would end up mismatched against what was captured.
    const { total, stockError } = await buildOrderItems(items, couponCode, address?.country, req.user?.id, pointsToRedeem, shippingChoice, giftCardCode, 'razorpay', address?.pincode);
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
    const { items, address, couponCode, pointsToRedeem, guestInfo, giftCardCode, isGift, giftMessage, affiliateCode, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    // Must match whatever /razorpay/create computed the charged amount from —
    // the client is expected to send the same choice to both, same as it
    // already does for items/address/couponCode.
    const shippingChoice = req.body.shippingChoice === 'to_pay' ? 'to_pay' : 'shipping';

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
    let returningUser = null;
    if (!userId) {
      // Payment is already captured, so this must never reject — rejecting
      // would leave a paid customer with no order. An existing account with
      // this phone gets the order attached (it's theirs, and /razorpay/create
      // already demanded the OTP), but a token is only issued if that OTP
      // proof is actually present — so someone who called this route directly
      // can't buy their way into a stranger's account.
      const existing = await findUserByPhone(address.phone);
      if (existing) {
        userId = existing.id;
        if (existing.role !== 'admin' && isPhoneVerified(address.phone)) returningUser = existing;
      } else {
        const resolved = await resolveGuestUser(guestInfo, address.phone);
        if (resolved.error) return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
        newAccount = resolved.user;
        await db.put('users', newAccount);
        userId = newAccount.id;
      }
      consumePhoneVerification(address.phone);
    }
    // Same rule as the token below: only write back to an already-existing
    // account when this checkout is signed in or OTP-proved. Attaching a paid
    // order to an unproved phone match is the lesser evil; letting it
    // overwrite that account's name and email would not be.
    if (req.user?.id || returningUser) await syncContactDetails(userId, guestInfo);

    // No stock re-check here: by this point Razorpay has already captured the
    // payment (verified via signature above), so rejecting on a stock race
    // would strand a paid customer with no order and no refund. The earlier
    // /razorpay/create check is the real gate; any oversell that still slips
    // through this narrow window is visible to the admin in Orders same as
    // a COD one and can be handled manually, same as any other refund case.
    const { orderItems, total, discount, couponCode: appliedCode, prepaidDiscount, pointsRedeemed, giftCardCode: appliedGiftCardCode, giftCardApplied } =
      await buildOrderItems(items, couponCode, address.country, userId, pointsToRedeem, shippingChoice, giftCardCode, 'razorpay', address.pincode);
    const order = await createOrderRecord({
      userId,
      orderItems,
      address,
      total,
      discount,
      couponCode: appliedCode,
      prepaidDiscount,
      pointsRedeemed,
      paymentMethod: 'razorpay',
      payment: { razorpay_order_id, razorpay_payment_id },
      shippingChoice,
      giftCardCode: appliedGiftCardCode,
      giftCardApplied,
      isGift,
      giftMessage,
      affiliateCode,
    });

    const response = { success: true, message: 'Payment verified and order placed.', order };
    const signInAs = newAccount || returningUser;
    if (signInAs) {
      response.token = signToken(signInAs);
      response.user = signInAs;
    }
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/cod-advance/create  { items, address, guestInfo? } →
// { razorpayOrderId, amount, currency, keyId } — a small flat advance
// (COD_ADVANCE_INR) to confirm a Cash-on-Delivery order; the remainder
// stays due on delivery, same as a plain COD order.
router.post('/cod-advance/create', optionalAuth, async (req, res, next) => {
  try {
    if (!razorpay.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Online payment isn’t set up yet — please choose Cash on Delivery instead.',
      });
    }
    // Rides on the same Razorpay rail as "Pay Online", so it needs that
    // method enabled too, not just its own flag — mirrors the frontend's
    // own gating (razorpayEnabled && enabledMethods.razorpay && codAdvance).
    const methods = await getPaymentMethodsConfig();
    if (!methods.razorpay || !methods.codAdvance) {
      return res.status(503).json({
        success: false,
        message: 'This payment option isn’t available right now — please choose another one.',
      });
    }
    const { items, couponCode, pointsToRedeem, address, guestInfo, giftCardCode } = req.body;
    const shippingChoice = req.body.shippingChoice === 'to_pay' ? 'to_pay' : 'shipping';
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }
    if (!address || !address.line1 || !address.pincode || !address.phone) {
      return res.status(400).json({ success: false, message: 'A complete delivery address is required.' });
    }

    if (!req.user) {
      // Pre-flight only, same as /razorpay/create — gate here so the verify
      // step below never rejects an order whose advance is already captured.
      const resolved = await resolveCheckoutUser(guestInfo, address.phone, { requireVerifiedForNew: false });
      if (resolved.error) return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
      if (resolved.needsVerification) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your phone number to continue.',
          requiresPhoneVerification: true,
        });
      }
    }

    const { total, stockError } = await buildOrderItems(items, couponCode, address.country, req.user?.id, pointsToRedeem, shippingChoice, giftCardCode, 'cod_advance', address.pincode);
    if (stockError) return res.status(400).json({ success: false, message: stockError });
    if (total <= COD_ADVANCE_INR) {
      return res.status(400).json({ success: false, message: `Order total must be greater than the ₹${COD_ADVANCE_INR} advance.` });
    }

    const rzpOrder = await razorpay.createOrder(COD_ADVANCE_INR, `yo_adv_${Date.now()}`);
    res.json({
      success: true,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      advanceAmount: COD_ADVANCE_INR,
      orderTotal: total,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/cod-advance/verify
// { items, address, guestInfo?, razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post('/cod-advance/verify', optionalAuth, async (req, res, next) => {
  try {
    const { items, address, couponCode, pointsToRedeem, guestInfo, giftCardCode, isGift, giftMessage, affiliateCode, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    // Must match whatever /cod-advance/create computed orderTotal from — the
    // client is expected to send the same choice to both.
    const shippingChoice = req.body.shippingChoice === 'to_pay' ? 'to_pay' : 'shipping';

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment confirmation details.' });
    }
    if (!address || !address.line1 || !address.pincode || !address.phone) {
      return res.status(400).json({ success: false, message: 'A complete delivery address is required.' });
    }
    if (!razorpay.verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Please contact support before retrying.' });
    }

    let userId = req.user?.id;
    let newAccount = null;
    let returningUser = null;
    if (!userId) {
      // Advance already captured — must never reject. Same rule as
      // /razorpay/verify: attach to the existing account, but only sign them
      // in if the OTP proof is actually present.
      const existing = await findUserByPhone(address.phone);
      if (existing) {
        userId = existing.id;
        if (existing.role !== 'admin' && isPhoneVerified(address.phone)) returningUser = existing;
      } else {
        const resolved = await resolveGuestUser(guestInfo, address.phone);
        if (resolved.error) return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
        newAccount = resolved.user;
        await db.put('users', newAccount);
        userId = newAccount.id;
      }
      consumePhoneVerification(address.phone);
    }
    // Signed-in or OTP-proved only, same rule as /razorpay/verify above.
    if (req.user?.id || returningUser) await syncContactDetails(userId, guestInfo);

    // No stock re-check here, same reasoning as /razorpay/verify — the
    // advance has already been captured by this point.
    const { orderItems, total, discount, couponCode: appliedCode, prepaidDiscount, pointsRedeemed, giftCardCode: appliedGiftCardCode, giftCardApplied } =
      await buildOrderItems(items, couponCode, address.country, userId, pointsToRedeem, shippingChoice, giftCardCode, 'cod_advance', address.pincode);
    const order = await createOrderRecord({
      userId,
      orderItems,
      address,
      total,
      discount,
      couponCode: appliedCode,
      prepaidDiscount,
      pointsRedeemed,
      paymentMethod: 'cod_advance',
      payment: { razorpay_order_id, razorpay_payment_id },
      advancePaid: COD_ADVANCE_INR,
      shippingChoice,
      giftCardCode: appliedGiftCardCode,
      giftCardApplied,
      isGift,
      giftMessage,
      affiliateCode,
    });

    const response = { success: true, message: 'Advance payment verified and order placed.', order };
    const signInAs = newAccount || returningUser;
    if (signInAs) {
      response.token = signToken(signInAs);
      response.user = signInAs;
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
    // What they already said about each one, so the Orders page can offer
    // "how did it go?" or "you said 4/5 — change it" rather than a button that
    // gives no clue whether it has been pressed before.
    const feedback = await db.list('order-feedback');
    const ratingByOrder = new Map(feedback.map((f) => [f.orderId, f.rating]));
    res.json({
      success: true,
      orders: orders.map((o) => ({ ...o, feedbackRating: ratingByOrder.get(o.id) ?? null })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/orders/:id/feedback-link → { token }
 *
 * The same form the WhatsApp message links to, reached from the customer's own
 * order history instead. The token is minted here rather than at delivery
 * because an order delivered before this existed has none, and because a
 * customer who never got the message — WhatsApp down, number changed — should
 * still be able to say how it went.
 *
 * Reuses whatever token the order already has, so the link in their WhatsApp
 * thread and the button on this page open the same form and the same answer.
 */
router.post('/:id/feedback-link', requireAuth, async (req, res, next) => {
  try {
    const order = await db.get('orders', req.params.id);
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: "We'll ask how it went once this order has been delivered.",
      });
    }
    res.json({ success: true, token: await ensureFeedbackToken(order) });
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
    // Nothing left the mill, so the bottles go back on the shelf.
    await restoreStockForOrder(order);

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

    // A cod_advance order already had its advance captured at checkout —
    // only the remaining balance should be charged here, or this would
    // double-charge that advance on top of what was already paid.
    const amountDue = order.total - (order.advancePaid || 0);
    const rzpOrder = await razorpay.createOrder(amountDue, `yo_pay_${order.orderNumber}`);
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

// POST /api/orders/:id/bottle-return  { quantity } — customer asks to send
// back empty glass bottles from a delivered order for a refill credit;
// admin approval (routes/admin.js) is what actually issues the coupon.
router.post('/:id/bottle-return', requireAuth, async (req, res, next) => {
  try {
    const order = await db.get('orders', req.params.id);
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Only delivered orders are eligible for a bottle return.' });
    }
    if (order.bottleReturn) {
      return res.status(400).json({ success: false, message: 'A bottle return has already been requested for this order.' });
    }

    const products = await db.list('products');
    const oilProductIds = new Set(products.filter((p) => p.category === 'oils').map((p) => p.id));
    const maxBottles = order.items
      .filter((it) => oilProductIds.has(it.productId))
      .reduce((sum, it) => sum + it.quantity, 0);
    if (maxBottles === 0) {
      return res.status(400).json({ success: false, message: 'This order has no oil bottles eligible for return.' });
    }

    const quantity = Math.min(Math.max(1, Math.floor(Number(req.body.quantity)) || 0), maxBottles);
    if (!quantity) {
      return res.status(400).json({ success: false, message: 'Enter how many bottles you’re returning.' });
    }

    order.bottleReturn = { quantity, status: 'requested', createdAt: new Date().toISOString() };
    await db.put('orders', order);

    const user = await db.get('users', order.userId);
    notifyAdminOfBottleReturn(order, user, quantity);

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id/bottle-return/qr — a QR code the customer can attach to
// the physical package, encoding a link straight to this request in Admin →
// Bottle Returns (opens to admin login if the scanning device isn't already
// signed in) so approving on receipt doesn't mean hunting through the list.
router.get('/:id/bottle-return/qr', requireAuth, async (req, res, next) => {
  try {
    const order = await db.get('orders', req.params.id);
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    if (!order.bottleReturn) {
      return res.status(400).json({ success: false, message: 'No bottle return request found for this order.' });
    }

    const { default: QRCode } = await import('qrcode');
    const siteUrl = process.env.SITE_URL || 'https://www.westerngodsorganic.com';
    const targetUrl = `${siteUrl.replace(/\/$/, '')}/admin/bottle-returns?order=${order.id}`;
    const qr = await QRCode.toDataURL(targetUrl);
    res.json({ success: true, qr, orderNumber: order.orderNumber });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
