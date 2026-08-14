/**
 * Delivering the invoice, on the day the parcel arrives.
 *
 * The invoice has always existed as a page the customer could find if they
 * logged in, opened the order and pressed print. Almost nobody does that, and
 * a business whose customers can't produce a bill looks like one that doesn't
 * issue them. Sending the file unprompted, once, at the moment the goods land
 * costs nothing and is what every established shop does.
 *
 * Both channels are attempted independently: an address with no email still
 * gets the WhatsApp copy, and a number WhatsApp can't reach still gets the
 * email. Neither failure is allowed to disturb the order — this runs after the
 * status has already been saved.
 */
const db = require('../data/db');
const { buildInvoicePdf, invoiceAmounts, invoiceFileName, money } = require('./invoicePdf');
const { getInvoiceSettings } = require('./invoiceSettings');
const { sendMail } = require('./mailer');
const { sendWhatsAppFile } = require('./whatsapp');

const SITE_URL = process.env.SITE_URL || 'https://westerngodsorganic.com';

/** The covering note, in both channels. Says what the file is, what it says,
 *  and — when money is still owed — how much, since a COD invoice arriving
 *  marked "paid" would be its own kind of wrong. */
function coveringMessage(order, amounts, settings) {
  const lines = [
    `*${settings.businessName}*`,
    '',
    `Thank you — order ${order.orderNumber} has been delivered.`,
    `Your bill is attached: ${amounts.total ? money(amounts.total) : ''} for ${(order.items || []).length} item(s).`,
  ];
  if (amounts.balanceDue > 0) {
    lines.push('', `Balance still to pay: *${money(amounts.balanceDue)}*.`);
  }
  lines.push(
    '',
    'Keep it for your records — it carries our address, licence details and the batch of every item.',
    `Order history: ${SITE_URL}/orders`,
  );
  return lines.join('\n');
}

function emailHtml(order, amounts, settings) {
  const rows = (order.items || []).map((it) => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #E8EDE8;">
        ${escapeHtml(it.name || 'Item')}${it.size ? `<br><span style="color:#6B7A70;font-size:12px;">${escapeHtml(it.size)}</span>` : ''}
      </td>
      <td style="padding:6px 0;border-bottom:1px solid #E8EDE8;text-align:right;">${it.quantity}</td>
      <td style="padding:6px 0;border-bottom:1px solid #E8EDE8;text-align:right;">${money(it.price * it.quantity)}</td>
    </tr>`).join('');

  return `
  <div style="font-family:Helvetica,Arial,sans-serif;color:#2C3A31;max-width:560px;">
    <h2 style="color:#1F3D2B;margin:0 0 4px;">Your bill for order ${escapeHtml(order.orderNumber)}</h2>
    <p style="color:#6B7A70;margin:0 0 16px;">Delivered — thank you for buying from ${escapeHtml(settings.businessName)}.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
    <p style="font-size:16px;margin:14px 0 0;"><b>Total ${money(amounts.total)}</b></p>
    ${amounts.balanceDue > 0
      ? `<p style="color:#A3543C;margin:4px 0 0;"><b>Balance still to pay: ${money(amounts.balanceDue)}</b></p>`
      : ''}
    <p style="color:#6B7A70;font-size:13px;margin:18px 0 0;">
      The full invoice is attached as a PDF — it carries our address, licence details and the batch of every item.
      You can also see it any time at <a href="${SITE_URL}/orders" style="color:#8A6B1E;">your orders page</a>.
    </p>
  </div>`;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Builds the invoice and sends it. Returns which channels actually delivered,
 * so the caller can record it and the admin can be told the truth rather than
 * an optimistic "sent".
 *
 * Idempotent by default: an order already invoiced is skipped, because an
 * admin flipping a status back and forth must not send the customer the same
 * bill four times. `force` is the manual re-send.
 */
async function sendInvoiceForOrder(order, { force = false } = {}) {
  if (!force && order.invoiceSentAt) return { skipped: 'already-sent', email: false, whatsapp: false };

  const [settings, user] = await Promise.all([
    getInvoiceSettings(),
    order.userId ? db.get('users', order.userId) : null,
  ]);
  const amounts = invoiceAmounts(order);
  const pdf = await buildInvoicePdf(order);
  const fileName = invoiceFileName(order);

  // The delivery address's own number is preferred over the account's: it is
  // who actually received the parcel, and on a gift order they are not the
  // same person.
  const phone = order.address?.phone || user?.phone || null;
  const email = user?.email || order.address?.email || null;

  const results = { email: false, whatsapp: false, fileName, bytes: pdf.length };

  if (email) {
    const r = await sendMail({
      to: email,
      subject: `Your bill for order ${order.orderNumber} — ${settings.businessName}`,
      text: coveringMessage(order, amounts, settings).replace(/\*/g, ''),
      html: emailHtml(order, amounts, settings),
      attachments: [{ filename: fileName, content: pdf, contentType: 'application/pdf' }],
    }).catch((err) => ({ sent: false, error: err.message }));
    results.email = !!r.sent;
  }

  if (phone) {
    const r = await sendWhatsAppFile(phone, {
      buffer: pdf,
      fileName,
      caption: coveringMessage(order, amounts, settings),
    }).catch((err) => ({ sent: false, error: err.message }));
    results.whatsapp = !!r.sent;
  }

  // Stamped only when something actually landed. An order whose invoice went
  // nowhere — no email on file, WhatsApp unpaired — stays eligible, so
  // reconnecting and re-marking it delivers the bill instead of silently
  // treating a total failure as done.
  if (results.email || results.whatsapp) {
    await db.put('orders', { ...order, invoiceSentAt: new Date().toISOString() });
  }
  return results;
}

module.exports = { sendInvoiceForOrder };
