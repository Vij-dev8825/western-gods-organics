const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getLedger, getPointsBalance, getTierInfo, REDEEM_VALUE_INR_PER_POINT } = require('../utils/loyalty');
const { getShippingSettings } = require('../utils/shippingSettings');

const router = express.Router();

// GET /api/loyalty (mine) — current balance + history + tier, newest first.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [balance, history, shippingSettings] = await Promise.all([
      getPointsBalance(req.user.id),
      getLedger(req.user.id),
      getShippingSettings(),
    ]);
    const tier = await getTierInfo(req.user.id, shippingSettings.domesticFreeThreshold);
    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, balance, history, redeemValueInr: REDEEM_VALUE_INR_PER_POINT, tier });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
