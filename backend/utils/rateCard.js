/**
 * The wholesale rate card — one page, as a PDF.
 *
 * Selling to a tiffin centre is not an e-commerce transaction. It is someone
 * standing at a counter at 4pm asking "what would a month of this cost me",
 * and the answer has to be something that can be handed over or forwarded on
 * WhatsApp, then read again by the owner that evening.
 *
 * Built from the wholesale prices already on the products, so it can never
 * quote a rate the shop wouldn't honour: a size with no wholesale price set
 * simply doesn't appear, rather than appearing at retail and being argued
 * about later.
 */
const PDFDocument = require('pdfkit');
const db = require('./../data/db');
const { getInvoiceSettings } = require('./invoiceSettings');
const { isNumber, finiteOrNull } = require('./num');
const { loadBrandLogo, drawFitted } = require('./pdfImage');

const FOREST = '#1F3D2B';
const INK = '#2C3A31';
const INK_SOFT = '#6B7A70';
const RULE = '#D8E0D8';
const GOLD = '#8A6B1E';

const MARGIN = 46;
const PAGE_W = 595.28;
const CONTENT_W = PAGE_W - MARGIN * 2;

const money = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

/** Every size that has a real wholesale price, grouped by product. */
async function wholesaleRows() {
  const products = await db.list('products');
  return products
    .map((p) => ({
      name: p.name,
      category: p.category,
      grower: [p.growerName, p.growerVillage].filter(Boolean).join(', '),
      sizes: (p.sizes || [])
        .filter((s) => isNumber(s.wholesalePrice) && finiteOrNull(s.wholesalePrice) > 0)
        .map((s) => ({
          label: s.label,
          retail: finiteOrNull(s.price) ?? 0,
          wholesale: finiteOrNull(s.wholesalePrice),
        })),
    }))
    .filter((p) => p.sizes.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {{ terms?: string, validUntil?: string }} opts — free text the mill
 *   sets per card (minimum order, credit terms, delivery days).
 */
async function buildRateCardPdf({ terms = '', validUntil = '' } = {}) {
  const [settings, rows] = await Promise.all([getInvoiceSettings(), wholesaleRows()]);
  if (rows.length === 0) {
    throw new Error('No product has a wholesale price yet — set one on at least one size in Products before printing a rate card.');
  }

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  /* Header — same treatment as the invoice: the logo stands in for the name
     when there is one, so a shop owner sees one consistent letterhead. */
  const logo = await loadBrandLogo(settings);
  let used = logo ? drawFitted(doc, logo, { x: MARGIN, y: MARGIN - 2, maxWidth: 140, maxHeight: 48 }) : 0;
  if (!used) {
    doc.font('Helvetica-Bold').fontSize(18).fillColor(FOREST).text(settings.businessName, MARGIN, MARGIN);
    used = doc.y - MARGIN;
  }
  doc.y = MARGIN + used;
  let y = doc.y + 2;
  doc.font('Helvetica').fontSize(8.5).fillColor(INK_SOFT);
  for (const bit of [settings.legalName, settings.address, `${settings.phone}  ·  ${settings.email}`]) {
    if (!bit) continue;
    doc.text(bit, MARGIN, y, { width: CONTENT_W * 0.68 });
    y = doc.y + 1;
  }
  const compliance = [settings.fssai && `FSSAI: ${settings.fssai}`, settings.gstin && `GSTIN: ${settings.gstin}`]
    .filter(Boolean).join('    ');
  if (compliance) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text(compliance, MARGIN, y, { width: CONTENT_W * 0.68 });
    y = doc.y;
  }
  doc.font('Helvetica-Bold').fontSize(13).fillColor(GOLD)
    .text('TRADE RATE CARD', MARGIN, MARGIN + 3, { width: CONTENT_W, align: 'right' });
  if (validUntil) {
    doc.font('Helvetica').fontSize(8).fillColor(INK_SOFT)
      .text(`Rates held until ${validUntil}`, MARGIN, MARGIN + 20, { width: CONTENT_W, align: 'right' });
  }

  y += 14;
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(RULE).lineWidth(1).stroke();
  y += 14;

  doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(
    'Cold-pressed in our own wood press at Udumalpet, in batches, to order. Prices below are per unit for trade accounts.',
    MARGIN, y, { width: CONTENT_W }
  );
  y = doc.y + 14;

  /* Table */
  const COL = { item: MARGIN + 8, size: MARGIN + 250, retail: MARGIN + 330, trade: MARGIN + 420 };
  doc.rect(MARGIN, y, CONTENT_W, 20).fillColor('#F2F6F1').fill();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(FOREST);
  doc.text('PRODUCT', COL.item, y + 6.5, { width: 230 });
  doc.text('SIZE', COL.size, y + 6.5, { width: 70 });
  doc.text('RETAIL', COL.retail, y + 6.5, { width: 78, align: 'right' });
  doc.text('YOUR RATE', COL.trade, y + 6.5, { width: 78, align: 'right' });
  y += 20;

  for (const product of rows) {
    if (y > 690) { doc.addPage(); y = MARGIN; }
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text(product.name, COL.item, y + 6, { width: 230 });
    let rowY = y;
    if (product.grower) {
      doc.font('Helvetica').fontSize(7).fillColor(INK_SOFT)
        .text(`Grown by ${product.grower}`, COL.item, y + 18, { width: 230 });
    }

    for (const size of product.sizes) {
      if (rowY > 700) { doc.addPage(); rowY = MARGIN; y = MARGIN; }
      doc.font('Helvetica').fontSize(9).fillColor(INK_SOFT);
      doc.text(size.label, COL.size, rowY + 6, { width: 70 });
      doc.text(money(size.retail), COL.retail, rowY + 6, { width: 78, align: 'right' });
      doc.font('Helvetica-Bold').fillColor(FOREST).text(money(size.wholesale), COL.trade, rowY + 6, { width: 78, align: 'right' });
      rowY += 16;
    }

    y = Math.max(rowY, y + (product.grower ? 30 : 22)) + 2;
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(RULE).lineWidth(0.5).stroke();
    y += 4;
  }

  /* Terms */
  y += 12;
  if (y > 660) { doc.addPage(); y = MARGIN; }
  if (terms) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text('TERMS', MARGIN, y, { characterSpacing: 0.6 });
    y = doc.y + 4;
    doc.font('Helvetica').fontSize(8.5).fillColor(INK_SOFT).text(terms, MARGIN, y, { width: CONTENT_W * 0.75 });
    y = doc.y + 12;
  }

  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(FOREST)
    .text(`To order, or to arrange a sample: ${settings.phone}`, MARGIN, y, { width: CONTENT_W });

  doc.end();
  return done;
}

module.exports = { buildRateCardPdf, wholesaleRows };
