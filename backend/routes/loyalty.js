const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getLedger, getPointsBalance, REDEEM_VALUE_INR_PER_POINT } = require('../utils/loyalty');

const router = express.Router();

// GET /api/loyalty (mine) — current balance + history, newest first.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [balance, history] = await Promise.all([
      getPointsBalance(req.user.id),
      getLedger(req.user.id),
    ]);
    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, balance, history, redeemValueInr: REDEEM_VALUE_INR_PER_POINT });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
