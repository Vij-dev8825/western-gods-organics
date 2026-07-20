/**
 * One-off CLI export of the WhatsApp/Meta product feed (CSV) and the
 * printable catalogue (PDF). Once a Meta Business Account is linked, prefer
 * pointing Commerce Manager's recurring "Data Feed" fetch at
 * GET /api/catalog/whatsapp.csv instead of re-running this — see
 * backend/routes/catalog.js. The PDF has no equivalent auto-sync; re-run
 * this (or hit GET /api/catalog/catalog.pdf) whenever you want a fresh copy
 * to send over chat.
 *
 * Usage: node scripts/export-whatsapp-catalog.js [siteUrl]
 *   siteUrl defaults to process.env.SITE_URL, then https://yamuna-organics.onrender.com
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../data/db');
const { buildCatalogRows, rowsToCsv } = require('../utils/whatsappCatalog');
const { buildCatalogPdf } = require('../utils/catalogPdf');

async function main() {
  const siteUrl = (process.argv[2] || process.env.SITE_URL || 'https://yamuna-organics.onrender.com').replace(/\/$/, '');

  await db.init();
  const { rows, warnings } = await buildCatalogRows({ siteUrl });
  const pdf = await buildCatalogPdf({ siteUrl });

  const outDir = path.join(__dirname, '..', 'exports');
  fs.mkdirSync(outDir, { recursive: true });

  const csvPath = path.join(outDir, 'whatsapp-catalog.csv');
  fs.writeFileSync(csvPath, rowsToCsv(rows), 'utf-8');
  const pdfPath = path.join(outDir, 'catalogue.pdf');
  fs.writeFileSync(pdfPath, pdf);

  console.log(`Wrote ${rows.length} catalog rows to ${csvPath}`);
  console.log(`Wrote a ${(pdf.length / 1024).toFixed(0)} KB PDF to ${pdfPath}`);
  console.log(`Image/link URLs are built against: ${siteUrl}`);
  if (warnings.length) {
    console.log('\nWarnings:');
    warnings.forEach((w) => console.log(` - ${w}`));
  }
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
