const express = require('express');
const { optionalAuth } = require('../middleware/auth');
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
        // Re-checked here rather than trusted from storage. PATCH /admin/coupons
        // spreads its body wholesale, so a value that never passed the check on
        // create can still land in the record — and this one ends up in an href.
        // A path on this site only: no scheme, no //host, nothing to smuggle a
        // javascript: or an off-site redirect through.
        promoLink: /^\/[^/]/.test(String(coupon.promoLink || '').trim())
          ? String(coupon.promoLink).trim()
          : '',
        promoCta: coupon.promoCta || '',
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/coupons/available?subtotal=N — every code this shopper could
// actually use right now, for the tap-to-apply chips in the cart. Replaces
// making them guess at an empty box (and leave the site to hunt for a code).
// Deliberately excludes other people's personal coupons: a signed-in shopper
// sees site-wide codes plus their own assigned ones (e.g. a referral reward
// they'd otherwise forget), a guest sees only site-wide ones.
router.get('/available', optionalAuth, async (req, res, next) => {
  try {
    const subtotal = Number(req.query.subtotal) || 0;
    const now = new Date();
    const coupons = (await db.list('coupons'))
      .filter((c) => c.active && !c.redeemed)
      .filter((c) => !c.expiresAt || new Date(c.expiresAt) >= now)
      .filter((c) => !c.assignedToUserId || c.assignedToUserId === req.user?.id)
      .map((c) => ({
        code: c.code,
        type: c.type,
        value: c.value,
        minOrder: c.minOrder || 0,
        // Personal codes are worth calling out — they're the ones a shopper
        // has forgotten about, unlike a site-wide code they just saw advertised.
        personal: !!c.assignedToUserId,
        // Shown as a disabled "spend ₹X more" chip rather than hidden, so the
        // shopper can see what's within reach instead of wondering why nothing
        // applied — the same nudge as a free-shipping threshold counter.
        eligible: subtotal >= (c.minOrder || 0),
        discount: computeDiscount(c, subtotal),
      }))
      // Best offer first, but a personal code always outranks a site-wide one
      // of equal value since only this shopper can use it.
      .sort((a, b) => Number(b.personal) - Number(a.personal) || b.discount - a.discount);
    res.json({ success: true, coupons });
  } catch (err) {
    next(err);
  }
});

// POST /api/coupons/validate  { code, subtotal } — checkout preview only;
// the order-placement routes re-validate and recompute the discount
// server-side rather than trusting whatever this returned. Guests (no
// req.user) can preview site-wide coupons fine; personal/assigned coupons
// correctly fail without a matching userId, same as at order-placement time.
router.post('/validate', optionalAuth, async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    const coupon = await findValidCoupon(code, req.user?.id);
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
