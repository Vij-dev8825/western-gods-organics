const express = require('express');
const { buildCatalogRows, rowsToCsv } = require('../utils/whatsappCatalog');
const { buildCatalogPdf } = require('../utils/catalogPdf');

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
