const db = require('../data/db');

// userId is required to redeem a personal coupon (e.g. a referral reward) —
// omitted entirely for the regular site-wide coupons everyone can use.
async function findValidCoupon(code, userId) {
  if (!code) return null;
  const coupons = await db.list('coupons');
  const coupon = coupons.find((c) => c.code === code.trim().toUpperCase());
  if (!coupon || !coupon.active) return null;
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return null;
  if (coupon.redeemed) return null;
  if (coupon.assignedToUserId && coupon.assignedToUserId !== userId) return null;
  return coupon;
}

/** Discount in rupees, capped at the subtotal (never a negative order total). */
function computeDiscount(coupon, subtotal) {
  if (!coupon || subtotal < coupon.minOrder) return 0;
  const raw = coupon.type === 'flat' ? coupon.value : (subtotal * coupon.value) / 100;
  return Math.min(Math.round(raw), subtotal);
}

module.exports = { findValidCoupon, computeDiscount };
