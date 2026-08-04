/**
 * Printable packing slips for a batch of orders — one per page, so the day's
 * picking can be done from paper rather than by scrolling the admin table on a
 * screen next to the bench.
 *
 * Deliberately not an invoice: no prices, no tax, no totals except the cash to
 * collect on a COD order, because the person packing needs to know what to put
 * in the box and what to collect, and nothing else.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function slipHtml(order) {
  const a = order.address || {};
  const cashDue = order.paymentMethod === 'cod'
    ? order.total
    : order.paymentMethod === 'cod_advance'
      ? order.total - (order.advancePaid || 0)
      : 0;

  return `
    <section class="slip">
      <header>
        <div>
          <h1>Western Gods Organics</h1>
          <p class="muted">Packing slip</p>
        </div>
        <div class="right">
          <b>${esc(order.orderNumber)}</b>
          <p class="muted">${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
        </div>
      </header>

      <div class="to">
        <b>${esc(a.name || order.customer?.name || '')}</b><br/>
        ${esc(a.line1 || '')}${a.line2 ? `<br/>${esc(a.line2)}` : ''}<br/>
        ${esc([a.city, a.state, a.pincode].filter(Boolean).join(', '))}<br/>
        ${esc(a.phone || order.customer?.phone || '')}
      </div>

      <table>
        <thead><tr><th class="qty">Qty</th><th>Item</th><th>Size</th><th class="tick">Packed</th></tr></thead>
        <tbody>
          ${order.items.map((i) => `
            <tr>
              <td class="qty"><b>${i.quantity}</b></td>
              <td>${esc(i.name)}</td>
              <td>${esc(i.size)}</td>
              <td class="tick">☐</td>
            </tr>`).join('')}
        </tbody>
      </table>

      ${cashDue > 0 ? `<p class="cash"><b>COLLECT ON DELIVERY: ₹${cashDue}</b></p>` : '<p class="muted">Already paid online — collect nothing.</p>'}
      ${order.isGift ? `<p class="gift">🎁 Gift${order.giftMessage ? ` — write on card: "${esc(order.giftMessage)}"` : ''}. Leave the invoice out.</p>` : ''}
    </section>`;
}

const STYLES = `
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; color: #1a1a1a; }
  .slip { padding: 18mm 14mm; page-break-after: always; }
  .slip:last-child { page-break-after: auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start;
           border-bottom: 2px solid #1f3d2b; padding-bottom: 8px; }
  h1 { font-size: 16pt; margin: 0; color: #1f3d2b; }
  .right { text-align: right; }
  p { margin: 2px 0; }
  .muted { color: #666; font-size: 9pt; }
  .to { margin: 14px 0; font-size: 11pt; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11pt; }
  th, td { border-bottom: 1px solid #ddd; padding: 7px 4px; text-align: left; }
  th { background: #f3f1e9; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.04em; }
  .qty { width: 42px; }
  .tick { width: 62px; text-align: center; font-size: 15pt; }
  .cash { margin-top: 14px; padding: 8px; border: 2px solid #1f3d2b; font-size: 12pt; text-align: center; }
  .gift { margin-top: 10px; padding: 8px; background: #f3f1e9; font-size: 10pt; }
  @page { size: A4; margin: 0; }
`;

/** Opens the browser's print dialog with one slip per order. */
export function printPackingSlips(orders) {
  if (!orders?.length) return;
  const win = window.open('', '_blank');
  if (!win) {
    window.alert('Your browser blocked the print window. Allow pop-ups for this site and try again.');
    return;
  }
  win.document.write(
    `<!doctype html><html><head><title>Packing slips (${orders.length})</title>`
    + `<style>${STYLES}</style></head><body>${orders.map(slipHtml).join('')}</body></html>`
  );
  win.document.close();
  // Let the layout settle before the dialog opens, or the first slip can
  // print half-rendered.
  win.onload = () => { win.focus(); win.print(); };
}
