const express = require('express');
const db = require('../data/db');

const router = express.Router();

const PAGES = ['shop', 'categories', 'combos', 'gifting', 'contact', 'bulk-enquiry', 'store-locator'];

// GET /api/page-banners/:page — banner image/title/subtitle override for a static page
router.get('/:page', async (req, res, next) => {
  try {
    if (!PAGES.includes(req.params.page)) {
      return res.status(404).json({ success: false, message: 'Unknown page.' });
    }
    const settings = await db.get('page-banners', req.params.page);
    res.json({
      success: true,
      settings: settings || { id: req.params.page, bannerImage: '', bannerTitle: '', bannerSubtitle: '' },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.PAGES = PAGES;
