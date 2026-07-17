const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../data/db');
const { findValidCoupon, computeDiscount } = require('../utils/coupons');

const router = express.Router();

// GET /api/coupons/featured — the one active, non-expired coupon (if any)
// an admin has flagged for site-wide advertising (e.g. a homepage popup).
// No auth required: a coupon code is only useful once shown to shoppers.
router.get('/featured', async (req, res, next) => {
  try {
    const coupons = await db.list('coupons');
    const now = new Date();
    const coupon = coupons.find(
      (c) => c.featured && c.active && (!c.expiresAt || new Date(c.expiresAt) >= now)
    );
    if (!coupon) return res.json({ success: true, coupon: null });
    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        minOrder: coupon.minOrder,
        promoImage: coupon.promoImage || '',
        promoHeadline: coupon.promoHeadline || '',
        promoSubtext: coupon.promoSubtext || '',
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/coupons/validate  { code, subtotal } — checkout preview only;
// the order-placement routes re-validate and recompute the discount
// server-side rather than trusting whatever this returned.
router.post('/validate', requireAuth, async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    const coupon = await findValidCoupon(code);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or expired coupon code.' });
    }
    if (Number(subtotal) < coupon.minOrder) {
      return res.status(400).json({ success: false, message: `This code needs a minimum order of ₹${coupon.minOrder}.` });
    }
    const discount = computeDiscount(coupon, Number(subtotal));
    res.json({ success: true, code: coupon.code, discount, type: coupon.type, value: coupon.value });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
