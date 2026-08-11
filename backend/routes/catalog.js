const express = require('express');
const { buildCatalogRows, rowsToCsv } = require('../utils/whatsappCatalog');
const { buildCatalogPdf } = require('../utils/catalogPdf');
const { buildGoogleFeed } = require('../utils/googleFeed');

const router = express.Router();

// GET /api/catalog/whatsapp.csv — a Meta Commerce Manager product feed.
// Point Commerce Manager → Catalog → Data Sources → Add Items → Data Feed →
// "Set a schedule" at this URL (e.g. daily) so the WhatsApp Business catalog
// linked to that Meta Business Account stays in sync automatically whenever
// prices or stock change here — no manual re-upload needed.
router.get('/whatsapp.csv', async (req, res, next) => {
  try {
    const siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const { rows, warnings } = await buildCatalogRows({ siteUrl });
    warnings.forEach((w) => console.warn('[whatsapp-catalog]', w));

    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'inline; filename="whatsapp-catalog.csv"');
    res.send(rowsToCsv(rows));
  } catch (err) {
    next(err);
  }
});

// GET /api/catalog/google.xml — a Google Merchant Center product feed.
// In Merchant Center: Products → Data sources → Add product source →
// "Scheduled fetch", pointing at this URL on a daily schedule. Prices and
// stock then stay in step with the shop on their own. Free Shopping listings
// need nothing beyond an approved feed and a verified site; a paid Shopping
// campaign later reads from the same source.
router.get('/google.xml', async (req, res, next) => {
  try {
    const siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const { xml, warnings } = await buildGoogleFeed({ siteUrl });
    warnings.forEach((w) => console.warn('[google-feed]', w));

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

// GET /api/catalog/catalog.pdf — a printable/shareable product catalogue,
// e.g. to send directly in a WhatsApp chat or hand to a bulk-order customer
// (distinct from whatsapp.csv, which only WhatsApp's own Catalog UI reads).
router.get('/catalog.pdf', async (req, res, next) => {
  try {
    const siteUrl = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const pdf = await buildCatalogPdf({ siteUrl });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="western-gods-organics-catalogue.pdf"');
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
