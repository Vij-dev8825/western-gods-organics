const express = require('express');
const { recordVisit } = require('../utils/siteVisits');

const router = express.Router();

/**
 * POST /api/track/visit — a browser reporting that a real page loaded.
 *
 * Public and unauthenticated: it has to fire before anyone might ever log
 * in. The abuse surface (a script hammering this to inflate the count) is
 * handled in the util — per-IP throttle, a strict id shape, a bot-UA check,
 * and a cap on how large one day's record can grow.
 *
 * Always answers 204, even when it declined to store — a page-view beacon
 * should never surface an error, and there is no caller waiting on the
 * outcome either way.
 */
router.post('/', async (req, res) => {
  try {
    await recordVisit(req.body, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  } catch (err) {
    console.error('[track-visit] could not record:', err.message);
  }
  res.status(204).end();
});

module.exports = router;
