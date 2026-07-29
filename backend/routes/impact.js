const express = require('express');
const db = require('../data/db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Average weight of the glass bottles this program returns — a conservative,
// clearly-labeled estimate (not a scientific measurement), used only to turn
// a bottle count into a more tangible "grams of glass diverted" figure.
const GRAMS_PER_BOTTLE = 150;

// GET /api/impact — site-wide bottle-reuse totals (public), plus the
// caller's own count when logged in. Counts only APPROVED bottle returns
// (see routes/orders.js .../bottle-return), not merely requested ones, so
// the number reflects bottles actually confirmed back in reuse.
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const orders = await db.list('orders');
    const approved = orders.filter((o) => o.bottleReturn?.status === 'approved');
    const totalBottles = approved.reduce((sum, o) => sum + o.bottleReturn.quantity, 0);
    const myBottles = req.user
      ? approved.filter((o) => o.userId === req.user.id).reduce((sum, o) => sum + o.bottleReturn.quantity, 0)
      : 0;

    res.json({
      success: true,
      totalBottles,
      totalGlassDivertedGrams: totalBottles * GRAMS_PER_BOTTLE,
      myBottles,
      myGlassDivertedGrams: myBottles * GRAMS_PER_BOTTLE,
      gramsPerBottleEstimate: GRAMS_PER_BOTTLE,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
