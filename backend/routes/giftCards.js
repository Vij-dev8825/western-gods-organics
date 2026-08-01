const express = require('express');
const db = require('../data/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const razorpay = require('../utils/razorpay');
const { sendMail } = require('../utils/mailer');
const { sendWhatsApp } = require('../utils/whatsapp');
const { notifyUser } = require('../utils/notify');
const { DENOMINATIONS, MIN_AMOUNT, MAX_AMOUNT, findValidGiftCard, issueGiftCard } = require('../utils/giftCards');

const router = express.Router();

function isValidAmount(amount) {
  return Number.isFinite(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;
}

// GET /api/gift-cards/config — denominations + bounds, for the purchase page.
router.get('/config', (req, res) => {
  res.json({ success: true, denominations: DENOMINATIONS, minAmount: MIN_AMOUNT, maxAmount: MAX_AMOUNT });
});

// POST /api/gift-cards/validate  { code } — checkout preview/redemption
// check. optionalAuth: a guest can redeem a gift card at checkout same as a
// coupon; the order-placement routes re-validate and reclamp server-side
// rather than trusting whatever this returned (see orderBuilder.js).
router.post('/validate', optionalAuth, async (req, res, next) => {
  try {
    const card = await findValidGiftCard(req.body.code);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Invalid, expired, or already-used gift card code.' });
    }
    res.json({ success: true, code: card.id, balance: card.balance });
  } catch (err) {
    next(err);
  }
});

// POST /api/gift-cards/purchase/create  { amount } → Razorpay order.
// Requires login — a real payment with an account behind it, same reasoning
// as why other prepaid flows in this app don't spin up a fresh guest account
// before payment is taken.
router.post('/purchase/create', requireAuth, async (req, res, next) => {
  try {
    if (!razorpay.isConfigured()) {
      return res.status(503).json({ success: false, message: 'Online payment isn’t set up yet — please try again later.' });
    }
    const amount = Number(req.body.amount);
    if (!isValidAmount(amount)) {
      return res.status(400).json({ success: false, message: `Choose an amount between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT}.` });
    }
    const rzpOrder = await razorpay.createOrder(amount, `yo_gift_${Date.now()}`);
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

// POST /api/gift-cards/purchase/verify
// { amount, recipientName?, recipientEmail?, recipientPhone?, message?, razorpay_order_id, razorpay_payment_id, razorpay_signature }
// recipient fields are all optional — an empty recipient means the card is
// for the purchaser's own future use, not a gift to someone else.
router.post('/purchase/verify', requireAuth, async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, recipientName, recipientEmail, recipientPhone, message } = req.body;
    const amount = Number(req.body.amount);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment confirmation details.' });
    }
    if (!isValidAmount(amount)) {
      return res.status(400).json({ success: false, message: 'Invalid gift card amount.' });
    }
    if (!razorpay.verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Please contact support before retrying.' });
    }

    const user = await db.get('users', req.user.id);
    const card = await issueGiftCard({
      amount,
      purchaserUserId: req.user.id,
      purchaserName: user?.name,
      purchaserEmail: user?.email,
      recipientName: (recipientName || '').trim(),
      recipientEmail: (recipientEmail || '').trim(),
      recipientPhone: (recipientPhone || '').trim(),
      message: (message || '').trim(),
      payment: { razorpay_order_id, razorpay_payment_id },
    });

    const isForSelf = !card.recipientEmail && !card.recipientPhone;
    const greeting = card.recipientName ? `Hi ${card.recipientName},\n\n` : '';
    const noteLine = card.message ? `\n\n"${card.message}"\n— ${card.purchaserName || 'A friend'}` : '';

    if (card.recipientEmail) {
      await sendMail({
        to: card.recipientEmail,
        subject: `You've received a ₹${amount} Western Gods Organics gift card!`,
        text:
          `${greeting}${card.purchaserName || 'Someone'} sent you a ₹${amount} gift card for Western Gods Organics.${noteLine}\n\n` +
          `Your code: ${card.id}\n\n` +
          `Redeem it at checkout on westerngodsorganic.com — valid for 1 year.`,
      }).catch(() => {});
    }
    if (card.recipientPhone) {
      await sendWhatsApp(
        card.recipientPhone,
        `*You've received a ₹${amount} Western Gods Organics gift card!*${noteLine}\n\n` +
          `Code: *${card.id}*\nRedeem it at checkout — valid for 1 year.`
      ).catch(() => {});
    }
    // The purchaser always gets their own copy too, in case a typo'd
    // recipient contact never arrives, or the card was bought for themself.
    if (user) {
      await notifyUser(user, {
        title: `Gift card purchased — ₹${amount}`,
        message: isForSelf
          ? `Your ₹${amount} gift card code is ${card.id}. Keep this for your records — redeem it at checkout anytime in the next year.`
          : `Your ₹${amount} gift card code is ${card.id}, sent to ${card.recipientName || card.recipientEmail || card.recipientPhone}. Keep this copy for your records too.`,
        channels: { inapp: true, email: true },
      });
    }

    res.status(201).json({ success: true, giftCard: card });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
