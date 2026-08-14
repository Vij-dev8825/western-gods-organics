/**
 * Builds a printable sheet of QR labels for one product's current batch.
 *
 * Every batch already has a public page — /batch/:batchNumber — showing when
 * it was pressed and where. Nothing in the physical world pointed at it. A QR
 * on the bottle closes that loop: it turns each bottle into a way back to the
 * shop, and it answers "is this actually what it says" at the one moment
 * someone is holding the bottle and wondering.
 *
 * A PDF rather than an image because these get printed. A grid on A4 at fixed
 * millimetre sizes prints the same from any machine, which a screenshot of a
 * web page does not.
 */
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const FOREST = '#1f3d2b';
const INK_SOFT = '#5c6b5e';
const LINE = '#d6ddc7';

// A4 in points (72 per inch). PDFKit's default unit.
const PAGE_MARGIN = 28;
const COLS = 3;
const ROWS = 6;
/** ~23mm square once printed. Below about 20mm a phone camera starts having to
 *  be coaxed, and these get scanned in a kitchen, not a lab. Trimmed from 26mm
 *  to buy back the line the grower's name needed. */
const QR_SIZE = 64;
const TOP_PAD = 6;
const BOTTOM_PAD = 4;
/** Gap between the text lines. Small on purpose: five lines have to fit under
 *  the code, and the last of them is the one worth reading without a phone. */
const LINE_GAP = 1;

const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : '');

/**
 * The text under the QR, laid out by walking a cursor down the label and
 * measuring each line before drawing it.
 *
 * The previous version positioned every line by a hand-computed offset from
 * the top and pinned the URL to the bottom — which put the URL *above* the
 * pressing date, five points apart, on every label ever printed. Offsets
 * cannot be checked by reading them; a cursor that refuses to draw past the
 * bottom edge cannot produce that at all.
 *
 * Lines are in falling order of importance, so when a long product name takes
 * two lines it is the URL that goes — the QR encodes it anyway — rather than
 * two lines printing on top of each other.
 */
function drawLabelText(doc, { x, y, w, h, product, batchNumber, url }) {
  const left = x + 5;
  const width = w - 10;
  const bottom = y + h - BOTTOM_PAD;
  let cursor = y + TOP_PAD + QR_SIZE + 4;

  const grower = [product.growerName, product.growerVillage].filter(Boolean).join(', ');
  const pressed = dateOnly(product.productionDate);

  const lines = [
    { text: product.name, font: 'Helvetica-Bold', size: 7.5, color: FOREST, maxLines: 2 },
    { text: batchNumber, font: 'Courier-Bold', size: 7, color: FOREST },
    pressed && { text: `Pressed ${pressed}`, font: 'Helvetica', size: 5.8, color: INK_SOFT },
    // The whole point of idea 09: a name and a village is a checkable claim,
    // where "organic" is a word anyone can print.
    grower && { text: `Grown by ${grower}`, font: 'Helvetica-Oblique', size: 5.8, color: INK_SOFT },
    { text: url.replace(/^https?:\/\//, ''), font: 'Helvetica', size: 5, color: INK_SOFT },
  ].filter(Boolean);

  for (const line of lines) {
    doc.font(line.font).fontSize(line.size);
    const opts = { width, align: 'center', lineBreak: !!line.maxLines };
    const needed = Math.min(
      doc.heightOfString(line.text, opts),
      line.size * 1.25 * (line.maxLines || 1)
    );
    // Out of room: drop this line rather than print it over the one above.
    if (cursor + needed > bottom) continue;
    doc.fillColor(line.color).text(line.text, left, cursor, { ...opts, height: needed, ellipsis: true });
    cursor += needed + LINE_GAP;
  }
}

function drawLabel(doc, { x, y, w, h, qrImage, product, batchNumber, url }) {
  doc.roundedRect(x, y, w, h, 5).lineWidth(0.6).dash(2, { space: 2 }).stroke(LINE);
  doc.undash();
  doc.image(qrImage, x + (w - QR_SIZE) / 2, y + TOP_PAD, { width: QR_SIZE, height: QR_SIZE });
  drawLabelText(doc, { x, y, w, h, product, batchNumber, url });
}

/**
 * @param {{product: object, siteUrl: string, count: number}} opts
 * @returns {Promise<Buffer>}
 */
async function buildBatchLabelPdf({ product, siteUrl, count }) {
  const batchNumber = product.batchNumber;
  if (!batchNumber) throw new Error('This product has no batch number yet — add one before printing labels.');

  const url = `${siteUrl.replace(/\/$/, '')}/batch/${encodeURIComponent(batchNumber)}`;

  // Rendered once and reused for every label on the sheet: the code is
  // identical across a batch, and re-encoding it sixty times would be sixty
  // identical PNGs.
  const qrImage = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 8,
    color: { dark: FOREST, light: '#ffffff' },
  });

  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, autoFirstPage: false });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const perPage = COLS * ROWS;
  const pages = Math.max(1, Math.ceil(count / perPage));
  let drawn = 0;

  for (let p = 0; p < pages; p++) {
    doc.addPage();
    const usableW = doc.page.width - PAGE_MARGIN * 2;
    const usableH = doc.page.height - PAGE_MARGIN * 2 - 16; // 16 leaves room for the footer
    const cellW = usableW / COLS;
    const cellH = usableH / ROWS;

    for (let r = 0; r < ROWS && drawn < count; r++) {
      for (let c = 0; c < COLS && drawn < count; c++) {
        drawLabel(doc, {
          x: PAGE_MARGIN + c * cellW,
          y: PAGE_MARGIN + r * cellH,
          w: cellW - 6,
          h: cellH - 6,
          qrImage,
          product,
          batchNumber,
          url,
        });
        drawn += 1;
      }
    }

    doc.font('Helvetica').fontSize(6.5).fillColor(INK_SOFT).text(
      `${product.name} · batch ${batchNumber} · ${count} label${count === 1 ? '' : 's'} · sheet ${p + 1} of ${pages}`,
      PAGE_MARGIN,
      doc.page.height - PAGE_MARGIN + 4,
      { width: doc.page.width - PAGE_MARGIN * 2, align: 'center', lineBreak: false }
    );
  }

  doc.end();
  return done;
}

module.exports = { buildBatchLabelPdf };
