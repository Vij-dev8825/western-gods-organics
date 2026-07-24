const { v4: uuid } = require('uuid');
const db = require('../data/db');
const { notifyUser } = require('./notify');
const { findValidCoupon, computeDiscount } = require('./coupons');
const { sendMail } = require('./mailer');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.CONTACT_NOTIFY_EMAIL;
const REFERRAL_REWARD_INR = 100;

function notifyAdminOfOrder(order, user) {
  if (!ADMIN_EMAIL) return;
  const itemLines = order.items.map((i) => `${i.quantity}× ${i.name} (${i.size}) — ₹${i.price}`).join('\n');
  sendMail({
    to: ADMIN_EMAIL,
    subject: `New order ${order.orderNumber} — ₹${order.total}`,
    text:
      `Customer: ${user?.name || 'Unknown'} (${user?.phone || '—'})\n` +
      `Payment: ${order.paymentMethod}${order.paymentMethod === 'razorpay' ? ' (paid)' : ' (COD)'}\n\n` +
      `Items:\n${itemLines}\n\n` +
      `Total: ₹${order.total}\n\n` +
      `Delivery address:\n${order.address.line1}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}` +
      `${order.address.country && order.address.country !== 'IN' ? ` (${order.address.country})` : ''}\n` +
      `Phone: ${order.address.phone}`,
  }).catch(() => {});
}

const DOMESTIC_COUNTRY = 'IN';
const DEFAULT_INTL_SHIPPING = 1500;

// International shipping is a flat ₹ fee per destination country (admin-set
// via /admin/currency-overrides' `shipping` map, keyed by country code — a
// destination concept, unlike the currency-keyed rate/minOrder overrides),
// falling back to DEFAULT_INTL_SHIPPING when the admin hasn't set one. India
// keeps the existing tiered domestic rate untouched.
async function calculateShipping(subtotal, destCountry = DOMESTIC_COUNTRY) {
  if (subtotal === 0) return 0;
  if (destCountry === DOMESTIC_COUNTRY) return subtotal > 999 ? 0 : 60;
  const overrides = await db.get('currency-overrides', 'main');
  return overrides?.shipping?.[destCountry] || DEFAULT_INTL_SHIPPING;
}

async function buildOrderItems(items, couponCode, destCountry, userId) {
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
  const shipping = await calculateShipping(subtotal, destCountry);

  const coupon = await findValidCoupon(couponCode, userId);
  const discount = computeDiscount(coupon, subtotal);

  return {
    orderItems,
    subtotal,
    shipping,
    discount,
    couponCode: discount > 0 ? coupon.code : null,
    total: subtotal + shipping - discount,
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

async function createOrderRecord({ userId, orderItems, address, total, discount, couponCode, paymentMethod, payment, subscriptionId }) {
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
    paymentStatus: paymentMethod === 'razorpay' ? 'paid' : 'pending',
    payment: payment || null,
    discount: discount || 0,
    couponCode: couponCode || null,
    subscriptionId: subscriptionId || null,
    total,
    status: 'placed',
    createdAt: new Date().toISOString(),
  };
  await db.put('orders', order);
  if (!subscriptionId) {
    // Subscription-generated orders don't touch the customer's live cart.
    await db.put('carts', { id: userId, items: [] });
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
      channels: { inapp: true, email: true },
    });
  }
  notifyAdminOfOrder(order, user);
  return order;
}

module.exports = { calculateShipping, buildOrderItems, createOrderRecord };
