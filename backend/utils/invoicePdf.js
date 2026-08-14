/**
 * The invoice as a PDF, built on the server so it can be attached to an email
 * or sent as a WhatsApp document.
 *
 * The site already had an invoice — a printable page the customer had to log
 * in, find the order, and press Ctrl+P on. That is not a document anyone keeps.
 * A file that arrives when the parcel does is.
 *
 * Every figure comes from the same helpers the profit report uses, so this
 * file, the web invoice and the accounts can never quietly disagree about what
 * an order was worth.
 *
 * Rupees are written "Rs." on purpose. PDFKit's built-in fonts are WinAnsi and
 * have no glyph for U+20B9 — a real invoice with a mojibake total on every
 * line is worse than one that spells it out, and no font is bundled with this
 * app to embed instead.
 */
const PDFDocument = require('pdfkit');
const { getInvoiceSettings } = require('./invoiceSettings');
const { deriveShipping, lineSubtotal } = require('./profit');

const FOREST = '#1F3D2B';
const INK = '#2C3A31';
const INK_SOFT = '#6B7A70';
const RULE = '#D8E0D8';
const GOLD = '#8A6B1E';

const MARGIN = 46;
const PAGE_W = 595.28; // A4 portrait
const CONTENT_W = PAGE_W - MARGIN * 2;

const money = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const PAYMENT_LABEL = {
  razorpay: 'Paid online',
  cod: 'Cash on Delivery',
  cod_advance: 'Part-paid, balance on delivery',
};

/** Every money line on the invoice, derived once so the caller can reuse them
 *  in the covering message without recomputing and drifting. */
function invoiceAmounts(order) {
  const subtotal = lineSubtotal(order);
  const shipping = deriveShipping(order);
  const discount = Number(order.discount) || 0;
  const prepaidDiscount = Number(order.prepaidDiscount) || 0;
  const pointsDiscount = Number(order.pointsRedeemed) || 0; // 1 point = Rs.1
  const giftCardApplied = Number(order.giftCardApplied) || 0;
  const isToPay = order.shippingChoice === 'to_pay';

  // What the customer has actually handed over: a prepaid order is settled,
  // a part-advance order only by its advance, a COD order by nothing yet.
  const received =
    order.paymentMethod === 'razorpay' ? Number(order.total) || 0
      : order.paymentMethod === 'cod_advance' ? Number(order.advancePaid) || 0
        : 0;

  return {
    subtotal, shipping, discount, prepaidDiscount, pointsDiscount, giftCardApplied, isToPay,
    total: Number(order.total) || 0,
    received,
    balanceDue: Math.max(0, (Number(order.total) || 0) - received),
  };
}

function header(doc, settings) {
  doc.font('Helvetica-Bold').fontSize(17).fillColor(FOREST)
    .text(settings.businessName, MARGIN, MARGIN, { width: CONTENT_W * 0.62 });

  let y = doc.y + 2;
  doc.font('Helvetica').fontSize(8.5).fillColor(INK_SOFT);
  for (const bit of [settings.legalName, settings.address, `${settings.phone}  ·  ${settings.email}`]) {
    if (!bit) continue;
    doc.text(bit, MARGIN, y, { width: CONTENT_W * 0.62 });
    y = doc.y + 1;
  }
  const compliance = [settings.gstin && `GSTIN: ${settings.gstin}`, settings.fssai && `FSSAI: ${settings.fssai}`]
    .filter(Boolean).join('    ');
  if (compliance) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text(compliance, MARGIN, y, { width: CONTENT_W * 0.62 });
    y = doc.y;
  }

  // The document title is a tax classification, not decoration — see
  // invoiceSettings.js. Right-aligned so it reads as the document's label.
  doc.font('Helvetica-Bold').fontSize(13).fillColor(GOLD)
    .text(settings.documentTitle || 'INVOICE', MARGIN, MARGIN + 2, { width: CONTENT_W, align: 'right' });

  return Math.max(y, MARGIN + 24) + 12;
}

function metaAndAddress(doc, order, settings, y) {
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(RULE).lineWidth(1).stroke();
  y += 14;

  const colW = CONTENT_W / 2 - 12;
  const invoiceDate = new Date(order.createdAt);
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + (Number(settings.dueDays) || 0));

  const rows = [
    ['Invoice no.', order.orderNumber],
    ['Date', fmtDate(invoiceDate)],
    ['Due date', fmtDate(dueDate)],
    ['Payment', PAYMENT_LABEL[order.paymentMethod] || order.paymentMethod || '—'],
    ...(order.deliveredAt ? [['Delivered', fmtDate(order.deliveredAt)]] : []),
  ];

  let leftY = y;
  for (const [label, value] of rows) {
    doc.font('Helvetica').fontSize(8).fillColor(INK_SOFT).text(label, MARGIN, leftY, { width: 66 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text(String(value), MARGIN + 70, leftY - 1, { width: colW - 70 });
    leftY += 14;
  }

  const a = order.address || {};
  const rightX = MARGIN + CONTENT_W / 2 + 12;
  let rightY = y;
  doc.font('Helvetica').fontSize(8).fillColor(INK_SOFT).text('BILL TO', rightX, rightY, { width: colW, characterSpacing: 0.6 });
  rightY = doc.y + 3;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(a.name || '—', rightX, rightY, { width: colW });
  rightY = doc.y + 1;
  doc.font('Helvetica').fontSize(8.5).fillColor(INK_SOFT);
  for (const bit of [
    a.line1, a.line2,
    [a.city, a.state].filter(Boolean).join(', '),
    [a.pincode, a.country || 'India'].filter(Boolean).join(' · '),
    a.phone && `Phone: ${a.phone}`,
  ].filter(Boolean)) {
    doc.text(String(bit), rightX, rightY, { width: colW });
    rightY = doc.y + 1;
  }

  return Math.max(leftY, rightY) + 12;
}

const COL = { item: MARGIN, qty: MARGIN + 300, rate: MARGIN + 350, total: MARGIN + 425 };
const NUM_W = 74;

function itemsTable(doc, order, y) {
  doc.rect(MARGIN, y, CONTENT_W, 20).fillColor('#F2F6F1').fill();
  doc.font('Helvetica-Bold').fontSize(8).fillColor(FOREST);
  doc.text('ITEM', COL.item + 8, y + 6.5, { width: 280 });
  doc.text('QTY', COL.qty, y + 6.5, { width: 40, align: 'right' });
  doc.text('RATE', COL.rate, y + 6.5, { width: NUM_W, align: 'right' });
  doc.text('AMOUNT', COL.total, y + 6.5, { width: NUM_W - 8, align: 'right' });
  y += 20;

  for (const it of order.items || []) {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.price) || 0;

    // Measured before drawing: a long product name wraps, and a fixed row
    // height would print the next line straight through it.
    const nameW = 280;
    doc.font('Helvetica-Bold').fontSize(9);
    const nameH = doc.heightOfString(it.name || 'Item', { width: nameW });
    const rowH = Math.max(nameH + 16, 30);

    if (y + rowH > 700) { doc.addPage(); y = MARGIN; }

    doc.fillColor(INK).text(it.name || 'Item', COL.item + 8, y + 6, { width: nameW });
    const sub = [it.size, it.batchNumber && `Batch ${it.batchNumber}`].filter(Boolean).join('  ·  ');
    if (sub) {
      doc.font('Helvetica').fontSize(7.5).fillColor(INK_SOFT).text(sub, COL.item + 8, y + 6 + nameH + 1, { width: nameW });
    }

    const numY = y + 7;
    doc.font('Helvetica').fontSize(9).fillColor(INK);
    doc.text(String(qty), COL.qty, numY, { width: 40, align: 'right' });
    doc.text(money(price), COL.rate, numY, { width: NUM_W, align: 'right' });
    doc.font('Helvetica-Bold').text(money(price * qty), COL.total, numY, { width: NUM_W - 8, align: 'right' });

    y += rowH;
    doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor(RULE).lineWidth(0.5).stroke();
  }
  return y;
}

function totals(doc, order, amounts, y) {
  const boxX = MARGIN + CONTENT_W - 230;
  const labelW = 140;
  const valueW = 82;
  y += 10;

  const lines = [
    ['Subtotal', money(amounts.subtotal)],
    amounts.isToPay
      ? ['Delivery (To Pay)', 'At delivery']
      : amounts.shipping > 0 ? ['Delivery', money(amounts.shipping)] : null,
    amounts.discount > 0 ? [`Coupon${order.couponCode ? ` (${order.couponCode})` : ''}`, `- ${money(amounts.discount)}`] : null,
    amounts.prepaidDiscount > 0 ? ['Prepaid discount', `- ${money(amounts.prepaidDiscount)}`] : null,
    amounts.pointsDiscount > 0 ? ['Reward points', `- ${money(amounts.pointsDiscount)}`] : null,
    amounts.giftCardApplied > 0 ? ['Gift card', `- ${money(amounts.giftCardApplied)}`] : null,
  ].filter(Boolean);

  for (const [label, value] of lines) {
    doc.font('Helvetica').fontSize(9).fillColor(INK_SOFT).text(label, boxX, y, { width: labelW, align: 'right' });
    doc.fillColor(INK).text(value, boxX + labelW + 6, y, { width: valueW, align: 'right' });
    y += 15;
  }

  y += 2;
  doc.moveTo(boxX, y).lineTo(PAGE_W - MARGIN, y).strokeColor(FOREST).lineWidth(1).stroke();
  y += 7;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(FOREST).text('TOTAL', boxX, y, { width: labelW, align: 'right' });
  doc.text(money(amounts.total), boxX + labelW + 6, y, { width: valueW, align: 'right' });
  y += 20;

  // Stating what is still owed matters most on the COD invoice, which is the
  // one arriving with a parcel someone still has to pay for.
  doc.font('Helvetica').fontSize(9).fillColor(INK_SOFT).text('Received', boxX, y, { width: labelW, align: 'right' });
  doc.fillColor(INK).text(money(amounts.received), boxX + labelW + 6, y, { width: valueW, align: 'right' });
  y += 15;
  doc.font(amounts.balanceDue > 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
    .fillColor(amounts.balanceDue > 0 ? '#A3543C' : INK_SOFT)
    .text('Balance due', boxX, y, { width: labelW, align: 'right' })
    .text(money(amounts.balanceDue), boxX + labelW + 6, y, { width: valueW, align: 'right' });

  return y + 24;
}

function footer(doc, settings, y) {
  if (y > 640) { doc.addPage(); y = MARGIN; }

  doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text('TERMS', MARGIN, y, { width: 320, characterSpacing: 0.6 });
  y = doc.y + 3;
  doc.font('Helvetica').fontSize(7.5).fillColor(INK_SOFT);
  for (const term of settings.terms || []) {
    doc.text(`•  ${term}`, MARGIN, y, { width: 320 });
    y = doc.y + 3;
  }

  const signX = PAGE_W - MARGIN - 150;
  const signY = Math.max(y + 10, 690);
  doc.moveTo(signX, signY).lineTo(PAGE_W - MARGIN, signY).strokeColor(RULE).lineWidth(0.8).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(INK_SOFT)
    .text(settings.signatoryName || 'Authorised Signatory', signX, signY + 4, { width: 150, align: 'center' });
  doc.fontSize(7).text(`For ${settings.businessName}`, signX, signY + 15, { width: 150, align: 'center' });
}

/** Renders the invoice and resolves with the finished PDF as a Buffer. */
async function buildInvoicePdf(order) {
  const settings = await getInvoiceSettings();
  const amounts = invoiceAmounts(order);

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  let y = header(doc, settings);
  y = metaAndAddress(doc, order, settings, y);
  y = itemsTable(doc, order, y);
  y = totals(doc, order, amounts, y);
  footer(doc, settings, y);

  doc.end();
  return done;
}

const invoiceFileName = (order) => `Invoice-${order.orderNumber}.pdf`;

module.exports = { buildInvoicePdf, invoiceAmounts, invoiceFileName, money };
