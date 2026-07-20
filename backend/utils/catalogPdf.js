/**
 * Builds a printable/shareable PDF product catalogue — the thing to actually
 * send over a WhatsApp chat or hand to a bulk buyer, as opposed to the CSV
 * feed (whatsappCatalog.js), which only WhatsApp's own Catalog UI reads.
 */
const PDFDocument = require('pdfkit');
const db = require('../data/db');
const { UPLOADS_DIR } = require('../data/seed');
const { resolveImageBuffer } = require('./catalogImages');

const BRAND = 'Western Gods Organics';
const TAGLINE = 'Directly from Farmers · Traditional Ways';
const ADDRESS = ['Shri Gopal Flour & Oil Mills,', 'Udumalpet, Tiruppur District,', 'Tamil Nadu – 642126'];
const PHONE = '+91 88258 75607';
const EMAIL = 'hello@yamunaorganics.com';

const FOREST = '#1f3d2b';
const LEAF_MID = '#3d6b47';
const LEAF_BRIGHT = '#5aab35';
const LEAF_PALE = '#8fd05f';
const INK_SOFT = '#5c6b5e';
const LINE = '#d6ddc7';
const TAG_BG = '#e3ecd6';

const PAGE_MARGIN = 50;
const IMAGE_BOX = 72;

function drawMark(doc, x, y) {
  doc.save();
  doc.circle(x, y, 22).lineWidth(2).stroke(LEAF_MID);
  doc.translate(x, y);
  doc.path('M 2,-2 C 4,-9 10,-15 17,-17 C 16,-9 12,-3 5,-1 Z').fill(LEAF_BRIGHT);
  doc.restore();
  doc.font('Times-Bold').fontSize(24).fillColor(LEAF_MID).text('W', x - 8, y - 13, { lineBreak: false });
}

function addFooter(doc, pageNumber, pageCount) {
  const bottom = doc.page.height - 34;
  // Drawing below the page's bottom margin makes pdfkit think the text
  // doesn't fit and silently start a new page instead of rendering here —
  // lift the margin out of the way for this one text call, then restore it.
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(INK_SOFT)
    .text(`${BRAND}  ·  ${PHONE}  ·  ${EMAIL}`, PAGE_MARGIN, bottom, {
      width: doc.page.width - PAGE_MARGIN * 2 - 60,
      lineBreak: false,
    });
  doc.text(`${pageNumber} / ${pageCount}`, doc.page.width - PAGE_MARGIN - 60, bottom, {
    width: 60,
    align: 'right',
    lineBreak: false,
  });

  doc.page.margins.bottom = savedBottom;
}

function ensureSpace(doc, needed) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function drawCategoryHeading(doc, label) {
  ensureSpace(doc, 40);
  doc.rect(PAGE_MARGIN, doc.y, doc.page.width - PAGE_MARGIN * 2, 26).fill(TAG_BG);
  doc
    .font('Times-Bold')
    .fontSize(13)
    .fillColor(FOREST)
    .text(label, PAGE_MARGIN + 12, doc.y - 20, { lineBreak: false });
  doc.moveDown(1.6);
}

function formatSizeLine(size) {
  const hasDiscount = size.mrp && size.mrp > size.price;
  // pdfkit's standard (non-embedded) fonts don't include the ₹ glyph — it
  // silently renders as a broken superscript character. "Rs." is guaranteed
  // to render correctly without embedding a custom Unicode font.
  const price = `Rs. ${size.price}`;
  const mrp = hasDiscount ? `  (MRP Rs. ${size.mrp})` : '';
  const stock = size.stock > 0 ? '' : '  — out of stock';
  return `${size.label} — ${price}${mrp}${stock}`;
}

async function drawProduct(doc, product) {
  const desc = product.shortDescription || product.description || '';
  const descHeight = doc.font('Helvetica').fontSize(9.5).heightOfString(desc, { width: doc.page.width - PAGE_MARGIN * 2 - IMAGE_BOX - 16 });
  const sizeLines = (product.sizes || []).length;
  const blockHeight = Math.max(IMAGE_BOX, 16 + descHeight + 8 + sizeLines * 13) + 18;

  ensureSpace(doc, blockHeight);
  const top = doc.y;
  const textX = PAGE_MARGIN + IMAGE_BOX + 16;
  const textWidth = doc.page.width - PAGE_MARGIN * 2 - IMAGE_BOX - 16;

  const imageBuffer = await resolveImageBuffer(product.image, UPLOADS_DIR).catch(() => null);
  if (imageBuffer) {
    try {
      doc.image(imageBuffer, PAGE_MARGIN, top, { fit: [IMAGE_BOX, IMAGE_BOX], align: 'center', valign: 'center' });
    } catch {
      // Corrupt/unsupported image bytes — skip silently, text still renders.
    }
  }
  doc.roundedRect(PAGE_MARGIN, top, IMAGE_BOX, IMAGE_BOX, 4).lineWidth(0.75).stroke(LINE);

  doc.font('Times-Bold').fontSize(12).fillColor(FOREST).text(product.name, textX, top, { width: textWidth });
  doc.font('Helvetica').fontSize(9.5).fillColor(INK_SOFT).text(desc, textX, doc.y + 2, { width: textWidth });

  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(LEAF_MID);
  for (const size of product.sizes || []) {
    doc.text(formatSizeLine(size), textX, doc.y, { width: textWidth, lineBreak: true });
  }

  doc.y = top + blockHeight - 10;
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y).lineWidth(0.5).stroke(LINE);
  doc.moveDown(0.8);
}

/** @param {{siteUrl: string}} opts @returns {Promise<Buffer>} */
async function buildCatalogPdf({ siteUrl }) {
  const [products, categories] = await Promise.all([db.list('products'), db.list('categories')]);

  const order = categories.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const labelFor = (slug) => order.find((c) => c.id === slug)?.label || slug.replace(/-/g, ' ');
  const knownSlugs = order.map((c) => c.id);
  const extraSlugs = [...new Set(products.map((p) => p.category))].filter((s) => !knownSlugs.includes(s));
  const categorySlugs = [...knownSlugs, ...extraSlugs];

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  // Cover
  drawMark(doc, PAGE_MARGIN + 22, PAGE_MARGIN + 22);
  doc
    .font('Times-Bold')
    .fontSize(15)
    .fillColor(LEAF_MID)
    .text('WESTERN GODS', PAGE_MARGIN + 54, PAGE_MARGIN + 8, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(FOREST).text('ORGANICS', PAGE_MARGIN + 54, PAGE_MARGIN + 26, {
    characterSpacing: 3,
    lineBreak: false,
  });
  doc.font('Helvetica').fontSize(8.5).fillColor(LEAF_MID).text(TAGLINE, PAGE_MARGIN + 54, PAGE_MARGIN + 40, { lineBreak: false });

  doc.y = PAGE_MARGIN + 100;
  doc.font('Times-Bold').fontSize(30).fillColor(FOREST).text('Product Catalogue', PAGE_MARGIN, doc.y, {
    width: doc.page.width - PAGE_MARGIN * 2,
  });
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor(INK_SOFT)
    .text('Cold-pressed oils, handmade soaps, herbal powders, spices and honey — pressed and packed at our own mill.', {
      width: doc.page.width - PAGE_MARGIN * 2,
    });

  doc.moveDown(2);
  const contactTop = doc.y;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(FOREST).text('Visit or order', PAGE_MARGIN, contactTop);
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(INK_SOFT)
    .text(ADDRESS.join('\n'), PAGE_MARGIN, doc.y + 2)
    .moveDown(0.3)
    .text(`Phone: ${PHONE}`)
    .text(`Email: ${EMAIL}`)
    .text(`Website: ${siteUrl.replace(/^https?:\/\//, '')}`);

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(INK_SOFT)
    .text(`Generated ${new Date().toISOString().slice(0, 10)} — prices and stock as listed on the website at time of generation.`, PAGE_MARGIN, doc.page.height - 90, {
      width: doc.page.width - PAGE_MARGIN * 2,
    });

  doc.addPage();

  for (const slug of categorySlugs) {
    const items = products.filter((p) => p.category === slug);
    if (!items.length) continue;
    drawCategoryHeading(doc, labelFor(slug));
    for (const product of items) {
      await drawProduct(doc, product);
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    addFooter(doc, i + 1, range.count);
  }

  doc.end();
  return done;
}

module.exports = { buildCatalogPdf };
