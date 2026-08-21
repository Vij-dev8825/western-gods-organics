const express = require('express');
const db = require('../data/db');

const router = express.Router();

/**
 * GET /api/announcements — the lines that scroll along the top of the site.
 *
 * Public and unauthenticated: this is the most visible copy on the shop and it
 * is nobody's secret. Returns an empty list rather than an error when nothing
 * has been set, so the client can fall back to its built-in line and the bar
 * is never blank.
 */
router.get('/', async (req, res, next) => {
  try {
    const settings = await db.get('announcements', 'main');
    const messages = Array.isArray(settings?.messages)
      ? settings.messages.map((m) => String(m || '').trim()).filter(Boolean)
      : [];
    res.json({
      success: true,
      // Off is a real choice: some weeks the shop has nothing to announce.
      active: settings?.active !== false && messages.length > 0,
      messages,
      // Pixels per second. Kept server-side so the pace can be tuned without a
      // deploy — a long line and a short one should not read at the same speed.
      speed: Math.min(Math.max(Number(settings?.speed) || 60, 10), 200),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
