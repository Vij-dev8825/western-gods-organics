const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { notifyUser } = require('./notify');
const { findValidCoupon, computeDiscount } = require('./coupons');
const { sendMail } = require('./mailer');
const { sendWhatsApp } = require('./whatsapp');
const { getPointsBalance, redeemPointsForOrder, getTierInfo, REDEEM_VALUE_INR_PER_POINT } = require('./loyalty');
const { getShippingSettings } = require('./shippingSettings');
const { findValidGiftCard, redeemGiftCardForOrder } = require('./giftCards');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.CONTACT_NOTIFY_EMAIL;
const REFERRAL_REWARD_INR = 100;
const BOTTLE_RETURN_CREDIT_INR = 20;
// Small flat advance to confirm a COD order at checkout (paymentMethod
// 'cod_advance') — low enough to stay low-friction, real enough to filter
// out non-serious/fake COD orders. Rest of the total is still cash on
// delivery, same as a plain COD order.
const COD_ADVANCE_INR = 49;

function paymentLineFor(order) {
  if (order.paymentMethod === 'razorpay') return 'Paid online (Razorpay)';
  if (order.paymentMethod === 'cod_advance') {
    return `₹${order.advancePaid} paid online, ₹${order.total - order.advancePaid} due on delivery (COD)`;
  }
  return 'Cash on Delivery';
}

function formatIST(dateStringOrDate) {
  return new Date(dateStringOrDate).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function notifyAdminOfOrder(order, user) {
  const itemLines = order.items.map((i) => `${i.quantity}× ${i.name} (${i.size}) — ₹${i.price}`).join('\n');
  const paymentLine = paymentLineFor(order);
  const placedAt = formatIST(order.createdAt);
  const addressLine =
    `${order.address.line1}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}` +
    `${order.address.country && order.address.country !== 'IN' ? ` (${order.address.country})` : ''}`;

  if (ADMIN_EMAIL) {
    sendMail({
      to: ADMIN_EMAIL,
      subject: `New order ${order.orderNumber} — ₹${order.total}`,
      text:
        `Customer: ${user?.name || 'Unknown'} (${user?.phone || '—'})\n` +
        `Payment: ${paymentLine}\n` +
        `Placed: ${placedAt}\n\n` +
        `Items:\n${itemLines}\n\n` +
        `Total: ₹${order.total}\n\n` +
        `Delivery address:\n${addressLine}\n` +
        `Phone: ${order.address.phone}`,
    }).catch(() => {});
  }

  // Admin's own WhatsApp (see utils/whatsappBaileys.js) — same number used to
  // log into /admin, kept separate from the customer-facing order updates.
  if (process.env.ADMIN_PHONE) {
    sendWhatsApp(
      process.env.ADMIN_PHONE,
      `*New order ${order.orderNumber}* — ₹${order.total}\n` +
        `${paymentLine}\n` +
        `Placed: ${placedAt}\n\n` +
        `${itemLines}\n\n` +
        `${user?.name || 'Unknown'} (${user?.phone || '—'})\n` +
        `${addressLine}`
    ).catch(() => {});
  }
}

// A COD order the customer later chose to prepay online (see
// POST /orders/:id/pay/verify) — a payment-method change on an existing
// order, not a new one, so it gets its own shorter admin message.
function notifyAdminOfPaymentSwitch(order, user) {
  const paidAt = formatIST(new Date());
  const message =
    `*Order ${order.orderNumber} — switched to online payment*\n` +
    `Paid online (Razorpay) at ${paidAt}\n` +
    `Total: ₹${order.total}\n` +
    `${user?.name || 'Unknown'} (${user?.phone || '—'})`;

  if (ADMIN_EMAIL) {
    sendMail({ to: ADMIN_EMAIL, subject: `Order ${order.orderNumber} — switched to online payment`, text: message }).catch(() => {});
  }
  if (process.env.ADMIN_PHONE) {
    sendWhatsApp(process.env.ADMIN_PHONE, message).catch(() => {});
  }
}

// A customer asked to return empty bottle(s) from a delivered order — tells
// the admin to expect them back physically; the credit itself is only
// issued once the admin approves (see routes/admin.js PATCH .../bottle-return).
function notifyAdminOfBottleReturn(order, user, quantity) {
  const message =
    `*Bottle return requested — order ${order.orderNumber}*\n` +
    `${quantity} bottle(s) from ${user?.name || 'Unknown'} (${user?.phone || '—'})\n` +
    `Review in Admin → Bottle Returns.`;
  if (ADMIN_EMAIL) {
    sendMail({ to: ADMIN_EMAIL, subject: `Bottle return requested — order ${order.orderNumber}`, text: message }).catch(() => {});
  }
  if (process.env.ADMIN_PHONE) {
    sendWhatsApp(process.env.ADMIN_PHONE, message).catch(() => {});
  }
}

const DOMESTIC_COUNTRY = 'IN';
const DEFAULT_INTL_SHIPPING = 1500;

// International shipping is a flat ₹ fee per destination country (admin-set
// via /admin/currency-overrides' `shipping` map, keyed by country code — a
// destination concept, unlike the currency-keyed rate/minOrder overrides),
// falling back to DEFAULT_INTL_SHIPPING when the admin hasn't set one. India
// keeps the existing tiered domestic rate untouched.
// shippingChoice ('shipping' | 'to_pay') is the customer's pick between the
// store's own known, fixed fee vs handing delivery to a courier who collects
// their own rate directly from the customer — a rate the store has no way to
// know in advance, so "to_pay" always charges nothing here.
async function calculateShipping(subtotal, destCountry = DOMESTIC_COUNTRY, userId = null, shippingChoice = 'shipping') {
  if (subtotal === 0) return 0;
  if (destCountry === DOMESTIC_COUNTRY) {
    if (shippingChoice === 'to_pay') return 0;
    const { domesticFee, domesticFreeThreshold, domesticShippingEnabled } = await getShippingSettings();
    if (!domesticShippingEnabled) return 0;
    // Silver/Gold loyalty tiers lower (or remove) the free-shipping bar
    // relative to this admin-set base — see backend/utils/loyalty.js TIERS.
    // Guests and brand-new (Bronze) customers get the base threshold as-is.
    const threshold = userId ? (await getTierInfo(userId, domesticFreeThreshold)).freeShippingMinOrder : domesticFreeThreshold;
    return subtotal > threshold ? 0 : domesticFee;
  }
  const overrides = await db.get('currency-overrides', 'main');
  return overrides?.shipping?.[destCountry] || DEFAULT_INTL_SHIPPING;
}

async function buildOrderItems(items, couponCode, destCountry, userId, pointsToRedeem = 0, shippingChoice = 'shipping', giftCardCode = null) {
  const products = await db.list('products');
  let subtotal = 0;
  let stockError = null;
  const orderItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const sizeInfo = product?.sizes.find((s) => s.label === item.size);
    const price = sizeInfo ? sizeInfo.price : 0;
    subtotal += price * item.quantity;
    if (!stockError) {
      if (!sizeInfo) stockError = `"${item.size}" is no longer available for this product.`;
      else if (sizeInfo.stock <= 0) stockError = `"${product.name} (${item.size})" is currently out of stock.`;
      else if (item.quantity > sizeInfo.stock) stockError = `Only ${sizeInfo.stock} unit(s) of "${product.name} (${item.size})" left in stock.`;
    }
    return {
      productId: item.productId,
      name: product?.name,
      size: item.size,
      quantity: item.quantity,
      price,
    };
  });
  const shipping = await calculateShipping(subtotal, destCountry, userId, shippingChoice);

  const coupon = await findValidCoupon(couponCode, userId);
  const discount = computeDiscount(coupon, subtotal);

  // Clamped against both the customer's real balance and the order's own
  // value — never trust the requested amount, and never let points push
  // the total below zero.
  let pointsRedeemed = 0;
  if (pointsToRedeem > 0 && userId) {
    const balance = await getPointsBalance(userId);
    const maxRedeemable = Math.max(0, subtotal + shipping - discount);
    pointsRedeemed = Math.min(Math.floor(pointsToRedeem), balance, maxRedeemable);
  }
  const pointsDiscount = pointsRedeemed * REDEEM_VALUE_INR_PER_POINT;

  // Applied after the coupon and points, on whatever's left — never trust
  // the requested code/amount, and never let it push the total below zero.
  let giftCardApplied = 0;
  let appliedGiftCardCode = null;
  if (giftCardCode) {
    const giftCard = await findValidGiftCard(giftCardCode);
    if (giftCard) {
      const remaining = Math.max(0, subtotal + shipping - discount - pointsDiscount);
      giftCardApplied = Math.min(giftCard.balance, remaining);
      appliedGiftCardCode = giftCard.id;
    }
  }

  return {
    orderItems,
    subtotal,
    shipping,
    discount,
    couponCode: discount > 0 ? coupon.code : null,
    pointsRedeemed,
    giftCardCode: giftCardApplied > 0 ? appliedGiftCardCode : null,
    giftCardApplied,
    total: subtotal + shipping - discount - pointsDiscount - giftCardApplied,
    stockError,
  };
}

// Grants the referrer a personal ₹100 coupon once the friend they referred
// places their first real order — see routes/auth.js's issueWelcomeCoupon
// for the mirror-image reward the referred customer already got at signup.
async function issueReferralReward(referrerId, referredName) {
  const referrer = await db.get('users', referrerId);
  if (!referrer) return;
  const coupon = {
    id: uuid(),
    code: `REF${uuid().replace(/-/g, '').slice(0, 6).toUpperCase()}`,
    type: 'flat',
    value: REFERRAL_REWARD_INR,
    minOrder: 0,
    expiresAt: null,
    active: true,
    featured: false,
    promoImage: '',
    promoHeadline: '',
    promoSubtext: '',
    assignedToUserId: referrerId,
    redeemed: false,
    createdAt: new Date().toISOString(),
  };
  await db.put('coupons', coupon);
  await notifyUser(referrer, {
    title: `You earned a ₹${REFERRAL_REWARD_INR} reward!`,
    message: `${referredName || 'Your friend'} just placed their first order using your referral link. Use code ${coupon.code} for ₹${REFERRAL_REWARD_INR} off your next order.`,
    channels: { inapp: true, email: true },
  });
}

// Rewards a customer for returning an empty glass bottle for reuse — a flat
// ₹20/bottle coupon, same shape/pattern as issueReferralReward above.
async function issueBottleReturnCredit(userId, quantity) {
  const user = await db.get('users', userId);
  if (!user) return null;
  const value = BOTTLE_RETURN_CREDIT_INR * quantity;
  const coupon = {
    id: uuid(),
    code: `REFILL${uuid().replace(/-/g, '').slice(0, 6).toUpperCase()}`,
    type: 'flat',
    value,
    minOrder: 0,
    expiresAt: null,
    active: true,
    featured: false,
    promoImage: '',
    promoHeadline: '',
    promoSubtext: '',
    assignedToUserId: userId,
    redeemed: false,
    createdAt: new Date().toISOString(),
  };
  await db.put('coupons', coupon);
  await notifyUser(user, {
    title: `You earned a ₹${value} refill credit!`,
    message: `Thanks for returning ${quantity} bottle(s) for reuse — use code ${coupon.code} for ₹${value} off your next order.`,
    channels: { inapp: true, email: true, whatsapp: true },
  });
  return coupon;
}

async function createOrderRecord({ userId, orderItems, address, total, discount, couponCode, pointsRedeemed, paymentMethod, payment, subscriptionId, advancePaid, shippingChoice, giftCardCode, giftCardApplied, isGift, giftMessage }) {
  // Computed before this order is persisted, so it only reflects orders that
  // already existed — used below to detect a customer's genuine first order,
  // whether that's a manual checkout or their first subscription renewal.
  const isFirstOrder = (await db.list('orders')).filter((o) => o.userId === userId).length === 0;

  const order = {
    id: uuid(),
    orderNumber: `YO${Date.now().toString().slice(-8)}`,
    userId,
    items: orderItems,
    address,
    paymentMethod,
    paymentStatus: paymentMethod === 'razorpay' ? 'paid' : paymentMethod === 'cod_advance' ? 'partial' : 'pending',
    payment: payment || null,
    advancePaid: paymentMethod === 'cod_advance' ? advancePaid || 0 : 0,
    discount: discount || 0,
    couponCode: couponCode || null,
    pointsRedeemed: pointsRedeemed || 0,
    giftCardCode: giftCardCode || null,
    giftCardApplied: giftCardApplied || 0,
    isGift: !!isGift,
    giftMessage: isGift ? (giftMessage || '').slice(0, 500) : '',
    subscriptionId: subscriptionId || null,
    // "to_pay" only ever meant anything for domestic delivery (see
    // calculateShipping) — re-derive from the address here too, so a
    // request that sent it for an international order (which was actually
    // charged the flat international fee) doesn't get persisted as
    // "collected by courier, nothing charged" and mislead the invoice.
    shippingChoice: (!address.country || address.country === 'IN') && shippingChoice === 'to_pay' ? 'to_pay' : 'shipping',
    total,
    status: 'placed',
    createdAt: new Date().toISOString(),
  };
  await db.put('orders', order);
  if (!subscriptionId) {
    // Subscription-generated orders don't touch the customer's live cart.
    await db.put('carts', { id: userId, items: [] });
  }
  if (pointsRedeemed > 0) {
    await redeemPointsForOrder(userId, order, pointsRedeemed);
  }
  if (giftCardApplied > 0) {
    await redeemGiftCardForOrder(giftCardCode, giftCardApplied, order);
  }

  // A personal single-use coupon (welcome/referral reward) is spent the
  // moment it's used in a placed order — everyday site-wide coupons have no
  // assignedToUserId and are unaffected.
  if (couponCode) {
    const coupons = await db.list('coupons');
    const usedCoupon = coupons.find((c) => c.code === couponCode);
    if (usedCoupon?.assignedToUserId === userId) {
      usedCoupon.redeemed = true;
      await db.put('coupons', usedCoupon);
    }
  }

  const user = await db.get('users', userId);

  if (isFirstOrder && user?.referredBy && !user.referralRewardIssued) {
    await issueReferralReward(user.referredBy, user.name);
    user.referralRewardIssued = true;
    await db.put('users', user);
  }

  if (user) {
    await notifyUser(user, {
      title: `Order ${order.orderNumber} placed`,
      message: subscriptionId
        ? `Your subscription renewed: ${orderItems.length} item(s) totalling ₹${total}. We'll notify you when it ships.`
        : `We've received your order of ${orderItems.length} item(s) totalling ₹${total}. We'll notify you when it ships.`,
      meta: { orderId: order.id },
      channels: { inapp: true, email: true, whatsapp: true },
    });
  }
  notifyAdminOfOrder(order, user);
  return order;
}

module.exports = {
  calculateShipping,
  buildOrderItems,
  createOrderRecord,
  notifyAdminOfPaymentSwitch,
  issueBottleReturnCredit,
  notifyAdminOfBottleReturn,
  COD_ADVANCE_INR,
};
