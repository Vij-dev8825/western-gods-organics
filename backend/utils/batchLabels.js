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
/** ~26mm square once printed. Below about 20mm a phone camera starts having to
 *  be coaxed, and these get scanned in a kitchen, not a lab. */
const QR_SIZE = 74;

const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : '');

function drawLabel(doc, { x, y, w, h, qrImage, product, batchNumber, url }) {
  doc.roundedRect(x, y, w, h, 5).lineWidth(0.6).dash(2, { space: 2 }).stroke(LINE);
  doc.undash();

  doc.image(qrImage, x + (w - QR_SIZE) / 2, y + 9, { width: QR_SIZE, height: QR_SIZE });

  let textY = y + QR_SIZE + 14;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(FOREST)
    .text(product.name, x + 6, textY, { width: w - 12, align: 'center', lineBreak: true, height: 18 });

  textY = y + QR_SIZE + 32;
  doc.font('Courier-Bold').fontSize(7).fillColor(FOREST)
    .text(batchNumber, x + 6, textY, { width: w - 12, align: 'center', lineBreak: false });

  const pressed = dateOnly(product.productionDate);
  if (pressed) {
    doc.font('Helvetica').fontSize(6).fillColor(INK_SOFT)
      .text(`Pressed ${pressed}`, x + 6, textY + 10, { width: w - 12, align: 'center', lineBreak: false });
  }
  doc.font('Helvetica').fontSize(5.2).fillColor(INK_SOFT)
    .text(url.replace(/^https?:\/\//, ''), x + 4, y + h - 11, { width: w - 8, align: 'center', lineBreak: false });
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
