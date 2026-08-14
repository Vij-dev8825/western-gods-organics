/**
 * Plain CSV exports of the three things an accountant, a GST filing, or a
 * spreadsheet ever asks for: orders, the catalogue, and customers.
 *
 * Deliberately one row per order *line*, not per order. A row per order forces
 * either a comma-mangled "3× Castor 500ml, 1× Neem Soap" cell or a lost
 * breakdown, and neither can be pivoted. One row per line is the shape every
 * spreadsheet wants and the only one that adds up.
 */
const db = require('../data/db');
const { orderEconomics, ledgerTotalsByOrder, deriveShipping, lineSubtotal } = require('./profit');
const { getPaymentMethodsConfig } = require('./paymentMethods');

/**
 * One CSV field.
 *
 * The leading-quote guard is not cosmetic: a value starting with = + - or @ is
 * executed as a formula when the file is opened in Excel or Sheets, so a
 * customer name typed as "=1+1" becomes a live cell, and worse is possible.
 * Prefixing an apostrophe makes it inert text.
 */
function cell(value) {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(columns, rows) {
  const head = columns.map((c) => cell(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => cell(c.value(row))).join(','));
  // \r\n and a UTF-8 BOM: Excel on Windows opens a plain UTF-8 CSV as mojibake,
  // which turns every ₹ and every Tamil name into rubbish.
  return `﻿${[head, ...body].join('\r\n')}\r\n`;
}

const date = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

/** One row per order line, with the order's own figures repeated on each —
 *  which is what lets a pivot table total by product, month or status. */
async function ordersCsv({ days }) {
  const since = days ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;
  const [orders, config] = await Promise.all([db.list('orders'), getPaymentMethodsConfig()]);
  const ledgerByOrder = await ledgerTotalsByOrder();
  const gatewayFeeRate = Math.min(Math.max(Number(config.gatewayFeePercent) || 0, 0), 100);

  const rows = [];
  for (const order of orders) {
    if (new Date(order.createdAt).getTime() < since) continue;
    const e = orderEconomics(order, { gatewayFeeRate, ledgerByOrder });
    const subtotal = lineSubtotal(order);
    for (const it of order.items || []) {
      const qty = Number(it.quantity) || 0;
      const lineRevenue = (Number(it.price) || 0) * qty;
      rows.push({
        order, item: it, qty, lineRevenue, e, subtotal,
        // Order-level money spread across lines by their share of the goods,
        // so summing any column over a filtered set still gives a true total.
        share: subtotal > 0 ? lineRevenue / subtotal : 0,
      });
    }
  }
  rows.sort((a, b) => new Date(b.order.createdAt) - new Date(a.order.createdAt));

  return toCsv([
    { header: 'Order number', value: (r) => r.order.orderNumber },
    { header: 'Date', value: (r) => date(r.order.createdAt) },
    { header: 'Status', value: (r) => r.order.status },
    { header: 'Payment', value: (r) => r.order.paymentMethod },
    { header: 'Payment status', value: (r) => r.order.paymentStatus },
    { header: 'Customer', value: (r) => r.order.address?.name },
    { header: 'Phone', value: (r) => r.order.address?.phone },
    { header: 'City', value: (r) => r.order.address?.city },
    { header: 'State', value: (r) => r.order.address?.state },
    { header: 'Pincode', value: (r) => r.order.address?.pincode },
    { header: 'Country', value: (r) => r.order.address?.country || 'India' },
    { header: 'Product', value: (r) => r.item.name },
    { header: 'Size', value: (r) => r.item.size },
    { header: 'Qty', value: (r) => r.qty },
    { header: 'Unit price', value: (r) => r.item.price },
    { header: 'Line revenue', value: (r) => Math.round(r.lineRevenue) },
    { header: 'Unit cost', value: (r) => (Number.isFinite(Number(r.item.costPrice)) ? r.item.costPrice : '') },
    { header: 'Line cost', value: (r) => (Number.isFinite(Number(r.item.costPrice)) ? Math.round(Number(r.item.costPrice) * r.qty) : '') },
    { header: 'Batch', value: (r) => r.item.batchNumber || '' },
    { header: 'Order subtotal', value: (r) => Math.round(r.subtotal) },
    { header: 'Order discount', value: (r) => r.order.discount || 0 },
    { header: 'Order shipping', value: (r) => r.e.shipping },
    { header: 'Order total', value: (r) => r.order.total },
    { header: 'Coupon', value: (r) => r.order.couponCode || '' },
    { header: 'Affiliate', value: (r) => r.order.affiliateCode || '' },
    { header: 'Line share of order', value: (r) => r.share.toFixed(4) },
  ], rows);
}

async function productsCsv() {
  const [products, orders] = await Promise.all([db.list('products'), db.list('orders')]);
  // Lifetime units, so the export answers "what actually moves" without
  // needing a second file to join against.
  const sold = {};
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    for (const it of o.items || []) {
      sold[`${it.productId}|${it.size}`] = (sold[`${it.productId}|${it.size}`] || 0) + (Number(it.quantity) || 0);
    }
  }

  const rows = [];
  for (const p of products) {
    for (const s of p.sizes || []) {
      rows.push({ p, s, unitsSold: sold[`${p.id}|${s.label}`] || 0 });
    }
  }

  return toCsv([
    { header: 'Product', value: (r) => r.p.name },
    { header: 'Category', value: (r) => r.p.category },
    { header: 'Size', value: (r) => r.s.label },
    { header: 'Price', value: (r) => r.s.price },
    { header: 'MRP', value: (r) => r.s.mrp },
    { header: 'Cost', value: (r) => (Number.isFinite(Number(r.s.costPrice)) ? r.s.costPrice : '') },
    {
      header: 'Margin per unit',
      value: (r) => (Number.isFinite(Number(r.s.costPrice)) ? Math.round(r.s.price - Number(r.s.costPrice)) : ''),
    },
    {
      header: 'Margin %',
      value: (r) => (Number.isFinite(Number(r.s.costPrice)) && r.s.price > 0
        ? Math.round(((r.s.price - Number(r.s.costPrice)) / r.s.price) * 100) : ''),
    },
    { header: 'Wholesale price', value: (r) => r.s.wholesalePrice ?? '' },
    { header: 'Stock', value: (r) => r.s.stock },
    { header: 'Units sold (lifetime)', value: (r) => r.unitsSold },
    { header: 'Batch', value: (r) => r.p.batchNumber || '' },
    { header: 'Grower', value: (r) => r.p.growerName || '' },
    { header: 'Village', value: (r) => r.p.growerVillage || '' },
    { header: 'Sold by', value: (r) => r.p.sellerId || '' },
  ], rows);
}

async function customersCsv() {
  const [users, orders] = await Promise.all([db.list('users'), db.list('orders')]);
  const stats = {};
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const s = (stats[o.userId] ||= { orders: 0, spent: 0, first: o.createdAt, last: o.createdAt });
    s.orders += 1;
    s.spent += Number(o.total) || 0;
    if (o.createdAt < s.first) s.first = o.createdAt;
    if (o.createdAt > s.last) s.last = o.createdAt;
  }

  const rows = users
    .filter((u) => u.role !== 'admin')
    .map((u) => ({ u, s: stats[u.id] || { orders: 0, spent: 0, first: null, last: null } }))
    .sort((a, b) => b.s.spent - a.s.spent);

  return toCsv([
    { header: 'Name', value: (r) => r.u.name },
    { header: 'Phone', value: (r) => r.u.phone },
    { header: 'Email', value: (r) => r.u.email || '' },
    { header: 'Joined', value: (r) => date(r.u.createdAt) },
    { header: 'Orders', value: (r) => r.s.orders },
    { header: 'Total spent', value: (r) => Math.round(r.s.spent) },
    { header: 'Average order', value: (r) => (r.s.orders ? Math.round(r.s.spent / r.s.orders) : 0) },
    { header: 'First order', value: (r) => date(r.s.first) },
    { header: 'Last order', value: (r) => date(r.s.last) },
    { header: 'Wholesale', value: (r) => (r.u.isWholesale ? 'yes' : '') },
    { header: 'Affiliate', value: (r) => (r.u.isAffiliate ? 'yes' : '') },
    { header: 'Seller', value: (r) => (r.u.isSeller ? 'yes' : '') },
    { header: 'Referred by', value: (r) => r.u.referredBy || '' },
  ], rows);
}

module.exports = { ordersCsv, productsCsv, customersCsv, toCsv, cell };
