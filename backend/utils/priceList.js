/**
 * The retail price list — one sheet, as a PDF.
 *
 * The trade rate card already exists, and answers "what would a month of this
 * cost my tiffin centre". This is its everyday twin: the sheet you hand to
 * someone standing at the mill asking what else you sell, or send back when a
 * message arrives on WhatsApp saying only "price?".
 *
 * Built from the same catalogue the shop runs on, so it can never quote a
 * price the website would not honour. A size with no price does not appear;
 * one that is out of stock appears with the fact said plainly, because
 * printing a price for something you cannot supply wastes a trip.
 *
 * Grouped by category rather than listed flat: someone reading it is deciding
 * between two oils, not scanning an inventory.
 */
const PDFDocument = require('pdfkit');
const db = require('./../data/db');
const { getInvoiceSettings } = require('./invoiceSettings');
const { finiteOrNull } = require('./num');
const { loadBrandLogo, drawFitted } = require('./pdfImage');

const FOREST = '#1F3D2B';
const INK = '#2C3A31';
const INK_SOFT = '#6B7A70';
const RULE = '#D8E0D8';
const GOLD = '#8A6B1E';

const MARGIN = 46;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - MARGIN - 40;

const money = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

// Printed headings for the category slugs the catalogue uses. Anything not
// listed falls back to its own slug, tidied — a new category still prints
// rather than vanishing because nobody updated this map.
const CATEGORY_LABELS = {
  oils: 'Cold-Pressed Oils',
  soaps: 'Handmade Soaps',
  powders: 'Powders',
  spices: 'Spices',
  honey: 'Honey',
  jaggery: 'Jaggery',
  'soup-dip': 'Soups & Dips',
  'soup-mix': 'Soups & Dips',
  combos: 'Kits & Combos',
};
const prettyCategory = (slug) =>
  CATEGORY_LABELS[slug] || String(slug || 'Other').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Every product with at least one real retail price, grouped by category. */
async function priceRows() {
  const products = await db.list('products');
  const groups = new Map();

  for (const p of products) {
    if (p.active === false) continue;
    const sizes = (p.sizes || [])
      .map((s) => ({
        label: s.label,
        price: finiteOrNull(s.price),
        inStock: (Number(s.stock) || 0) > 0,
      }))
      .filter((s) => s.price !== null && s.price > 0);
    if (sizes.length === 0) continue;

    const key = p.category || 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ name: p.name, sizes });
  }

  return [...groups.entries()]
    .map(([category, items]) => ({
      category,
      label: prettyCategory(category),
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function buildPriceListPdf({ note = '', validUntil = '' } = {}) {
  const [settings, groups] = await Promise.all([getInvoiceSettings(), priceRows()]);
  if (groups.length === 0) {
    throw new Error('No product has a price yet — add one in Products before printing a price list.');
  }

  // bufferPages so the footer can be stamped on every page after the last one
  // is laid out — switchToPage throws without it.
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  /* Header — the same letterhead as the invoice and the rate card. */
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
    .text('PRICE LIST', MARGIN, MARGIN + 3, { width: CONTENT_W, align: 'right' });
  if (validUntil) {
    doc.font('Helvetica').fontSize(8).fillColor(INK_SOFT)
      .text(`Prices held until ${validUntil}`, MARGIN, MARGIN + 20, { width: CONTENT_W, align: 'right' });
  }

  y += 14;
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(RULE).lineWidth(1).stroke();
  y += 14;

  doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(
    note || 'Cold-pressed in our own wood press at Udumalpet, in small batches. Prices include GST where applicable.',
    MARGIN, y, { width: CONTENT_W }
  );
  y = doc.y + 16;

  /* Two columns of name → price, so a full catalogue stays on one sheet.
     Balanced rather than filled: with only a handful of products, flowing
     top-to-bottom would fill the left column and leave the right half of the
     page blank, which reads as an unfinished document rather than a short
     catalogue. So the break is placed at roughly half the total height. */
  const COL_W = (CONTENT_W - 24) / 2;
  const colX = [MARGIN, MARGIN + COL_W + 24];
  const HEADER_H = 23;
  const ITEM_H = 12;
  const SIZE_H = 12;
  const groupHeight = (g) =>
    HEADER_H + g.items.reduce((sum, it) => sum + ITEM_H + it.sizes.length * SIZE_H + 5, 0) + 6;

  const totalHeight = groups.reduce((sum, g) => sum + groupHeight(g), 0);
  const columnTop = y;
  const available = BOTTOM - columnTop;
  // Only worth balancing when it all fits on this page; beyond that the
  // ordinary fill-and-overflow behaviour is what keeps pages full.
  const balanceAt = totalHeight <= available * 2 ? totalHeight / 2 : Infinity;
  let placed = 0;

  let col = 0;
  let cursor = y;

  const nextColumn = () => {
    if (col === 0) { col = 1; cursor = columnTop; return; }
    doc.addPage();
    col = 0;
    cursor = MARGIN;
  };
  const room = (needed) => {
    if (cursor + needed <= BOTTOM) return;
    nextColumn();
  };

  for (const group of groups) {
    // Move to the second column once half the content is behind us, so the
    // two columns end at roughly the same depth.
    if (col === 0 && placed > 0 && placed >= balanceAt) nextColumn();
    placed += groupHeight(group);
    room(34);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(FOREST)
      .text(group.label.toUpperCase(), colX[col], cursor, { width: COL_W, characterSpacing: 0.7 });
    cursor = doc.y + 2;
    doc.moveTo(colX[col], cursor).lineTo(colX[col] + COL_W, cursor).strokeColor(RULE).lineWidth(0.6).stroke();
    cursor += 7;

    for (const item of group.items) {
      room(16 + item.sizes.length * 12);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK)
        .text(item.name, colX[col], cursor, { width: COL_W });
      cursor = doc.y + 1;

      for (const size of item.sizes) {
        doc.font('Helvetica').fontSize(8.5).fillColor(INK_SOFT)
          .text(size.inStock ? size.label : `${size.label} — ask, currently out`, colX[col] + 8, cursor, { width: COL_W - 90 });
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(size.inStock ? INK : INK_SOFT)
          .text(money(size.price), colX[col] + COL_W - 78, cursor, { width: 78, align: 'right' });
        cursor += 12;
      }
      cursor += 5;
    }
    cursor += 6;
  }

  /* Footer on every page, since the sheet may be handed over one page at a time. */
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(FOREST)
      .text(`To order: ${settings.phone}  ·  ${settings.businessName}`, MARGIN, PAGE_H - MARGIN - 22, {
        width: CONTENT_W, align: 'center',
      });
  }
  doc.flushPages();

  doc.end();
  return done;
}

module.exports = { buildPriceListPdf, priceRows };
