const express = require('express');
const db = require('../data/db');

const router = express.Router();

/**
 * GET /api/flowers — the flowers the shop has added itself.
 *
 * On its own path rather than under /api/products, where a single-segment
 * route has to be declared above /:id or it is silently swallowed by it. That
 * trap has already cost this project one broken page.
 *
 * Public and unauthenticated: these are decorations on the shop front.
 * Returns an empty list rather than an error when none have been added, which
 * is the ordinary state — the built-in fifteen are shipped with the site and
 * the client falls back to them.
 */
router.get('/', async (req, res, next) => {
  try {
    const all = await db.list('pookalam-flowers');
    const flowers = all
      .filter((f) => f.active !== false && f.url)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)))
      .map((f) => ({
        id: f.id,
        label: f.label || 'Flower',
        gloss: f.gloss || '',
        url: f.url,
        // Whether it may be used as a falling petal. A sunflower is a fine
        // thing to lay in a pookalam and looks like a bug tumbling past a
        // headline, so the two uses are chosen separately.
        petal: f.petal !== false,
      }));
    res.json({ success: true, flowers });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/festival-characters — the figures the shop has supplied.
 *
 * Grouped by festival on the client rather than here, because the client is
 * the only one that knows which festival is running.
 */
router.get('/characters', async (req, res, next) => {
  try {
    const characters = (await db.list('festival-characters'))
      .filter((c) => c.active !== false && c.url)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)))
      .map((c) => ({ id: c.id, label: c.label || '', festival: c.festival || '', url: c.url, motion: c.motion || '' }));
    res.json({ success: true, characters });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
