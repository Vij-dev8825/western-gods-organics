const express = require('express');
const db = require('../data/db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { findAffiliateByCode, getCommissionSummary } = require('../utils/affiliates');

const router = express.Router();

// POST /api/affiliates/validate  { code } — checkout preview check, same
// intent as coupon/gift-card validate. optionalAuth: a guest can check a
// code same as a logged-in customer; attribution itself doesn't require an
// account on either side.
router.post('/validate', optionalAuth, async (req, res, next) => {
  try {
    const affiliate = await findAffiliateByCode(req.body.code);
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Invalid affiliate code.' });
    }
    res.json({ success: true, code: affiliate.affiliateCode });
  } catch (err) {
    next(err);
  }
});

// GET /api/affiliates/me — the logged-in customer's own affiliate portal
// data: their code, rate, and full commission ledger/summary. 404s (rather
// than an empty/zeroed response) for a non-affiliate account, so the
// frontend can tell "not an affiliate" apart from "affiliate with ₹0 earned".
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await db.get('users', req.user.id);
    if (!user?.isAffiliate) {
      return res.status(404).json({ success: false, message: 'This account is not enrolled in the affiliate program.' });
    }
    const summary = await getCommissionSummary(user.id);
    res.json({
      success: true,
      code: user.affiliateCode,
      commissionRate: user.commissionRate || 0,
      ...summary,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
