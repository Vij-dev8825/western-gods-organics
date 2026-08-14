import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.svg';
import ChakkiWheel from '../components/ChakkiWheel';
import { amountInWords } from '../utils/numberToWords';
import { getProductImage } from '../utils/productImages';

const PAYMENT_LABELS = { cod: 'Cash on Delivery', razorpay: 'Paid Online (Razorpay)', counter: 'Paid at the mill (cash / UPI)', cod_advance: 'Part-paid online, rest on delivery' };

export default function Invoice() {
  const { orderId } = useParams();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  // Business details, terms and signature all come from Admin → Invoice
  // Details. Null until loaded; the invoice waits for it rather than
  // flashing placeholder details and then correcting itself.
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getOrder(token, orderId).then((d) => setOrder(d.order)).catch((e) => setError(e.message));
  }, [token, orderId]);

  useEffect(() => {
    api.getInvoiceSettings().then((d) => setSettings(d.invoiceSettings)).catch(() => {});
  }, []);

  if (error) {
    return (
      <div className="container section center">
        <p className="alert alert-error" style={{ display: 'inline-block' }}>{error}</p>
        <div><Link to="/orders" className="btn btn-gold">Back to my orders</Link></div>
      </div>
    );
  }

  if (!order || !settings) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  const subtotal = order.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const totalQty = order.items.reduce((sum, it) => sum + it.quantity, 0);
  const discount = order.discount || 0;
  const prepaidDiscount = order.prepaidDiscount || 0;
  const pointsDiscount = order.pointsRedeemed || 0; // 1 point = ₹1, see backend/utils/loyalty.js
  const giftCardApplied = order.giftCardApplied || 0;
  // Isolates shipping as whatever's left after every other known deduction —
  // has to account for all of them or a points/gift-card order would show
  // the wrong shipping fee here (the residual would silently absorb them).
  const shipping = order.total - subtotal + discount + prepaidDiscount + pointsDiscount + giftCardApplied;
  // Orders placed before this existed have no shippingChoice — treat as the
  // default "shipping" (store-charged) path, same as they were charged.
  const isToPay = order.shippingChoice === 'to_pay';
  const showShippingRow = isToPay ? true : shipping > 0;
  const shippingLabel = isToPay ? 'To Pay' : 'Shipping';

  // What the customer has actually handed over so far — a prepaid order is
  // settled in full, a part-advance order only by its advance, and a plain
  // COD order not at all until it arrives.
  const received =
    order.paymentMethod === 'razorpay' ? order.total
    : order.paymentMethod === 'cod_advance' ? (order.advancePaid || 0)
    : 0;
  const balanceDue = Math.max(0, order.total - received);

  const invoiceDate = new Date(order.createdAt);
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + (Number(settings.dueDays) || 0));
  const fmt = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="invoice-page">
      <div className="invoice-toolbar no-print">
        <Link to="/orders" className="link-btn">← Back to my orders</Link>
        <button className="btn btn-gold btn-sm" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <div className="invoice-sheet">
        {/* Ornamental frame — two nested rules plus corner marks, drawn as
            empty elements so no invoice content sits inside them. */}
        <div className="invoice-frame" aria-hidden="true">
          <span className="invoice-corner tl" />
          <span className="invoice-corner tr" />
          <span className="invoice-corner bl" />
          <span className="invoice-corner br" />
        </div>

        {/* Faint centred logo behind the content — decorative only, so it's
            hidden from assistive tech and never intercepts clicks/selection. */}
        <img src={logo} alt="" aria-hidden="true" className="invoice-watermark" />

        <div className="invoice-body">
          <header className="invoice-head">
            <div className="invoice-brandmark">
              {/* The uploaded logo wins so the printed page and the PDF that
                  goes out on WhatsApp show the same mark. */}
              <img
                src={settings.logoImage ? getProductImage(settings.logoImage) : logo}
                alt={settings.businessName}
              />
            </div>
            <div className="invoice-brand">
              <h1>{settings.businessName}</h1>
              <div className="invoice-contact">
                {settings.phone && <span>📞 {settings.phone}</span>}
                {settings.email && <span>✉️ {settings.email}</span>}
              </div>
              {settings.address && (
                <div className="invoice-contact"><span>📍 {settings.address}</span></div>
              )}
              {(settings.gstin || settings.fssai) && (
                <div className="invoice-contact">
                  {settings.gstin && <span>GSTIN: {settings.gstin}</span>}
                  {settings.fssai && <span>FSSAI: {settings.fssai}</span>}
                </div>
              )}
              {settings.legalName && <div className="invoice-legal">{settings.legalName}</div>}
            </div>
            <div className="invoice-doctype">
              <b>{settings.documentTitle}</b>
              <span>ORIGINAL FOR RECIPIENT</span>
            </div>
          </header>

          <div className="invoice-meta-row">
            <div>
              <span>Invoice No.</span>
              <b>{order.orderNumber}</b>
            </div>
            <div>
              <span>Invoice Date</span>
              <b>{fmt(invoiceDate)}</b>
            </div>
            <div>
              <span>Due Date</span>
              <b>{fmt(dueDate)}</b>
            </div>
            <div>
              <span>Payment</span>
              <b>{PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</b>
            </div>
          </div>

          <div className="invoice-billto">
            <span>Bill To</span>
            <b>{order.address.name || order.address.phone}</b>
            <p>
              {order.address.line1}<br />
              {order.address.city}, {order.address.state} – {order.address.pincode}
              {order.address.country && order.address.country !== 'IN' ? <><br />{order.address.country}</> : null}
              <br />Phone: {order.address.phone}
            </p>
          </div>

          <table className="invoice-table">
            <thead>
              <tr>
                <th className="col-no">No</th>
                <th>Items</th>
                <th className="col-num">Qty.</th>
                <th className="col-num">Rate</th>
                <th className="col-num">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, i) => (
                <tr key={i}>
                  <td className="col-no">{i + 1}</td>
                  <td>{it.name} <span className="invoice-size">{it.size}</span></td>
                  <td className="col-num">{it.quantity}</td>
                  <td className="col-num">{it.price}</td>
                  <td className="col-num">{it.price * it.quantity}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>SUBTOTAL</td>
                <td className="col-num">{totalQty}</td>
                <td />
                <td className="col-num">₹ {subtotal}</td>
              </tr>
            </tfoot>
          </table>

          <div className="invoice-lower">
            <div className="invoice-terms">
              <b>Terms &amp; Conditions</b>
              <ol>
                {settings.terms.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </div>

            <div className="invoice-amounts">
              <div className="invoice-amount-lines">
                <div><span>Subtotal</span><span>₹ {subtotal}</span></div>
                {showShippingRow && (
                  <div><span>{shippingLabel}</span><span>{isToPay ? 'At delivery' : `₹ ${shipping}`}</span></div>
                )}
                {discount > 0 && (
                  <div><span>Coupon {order.couponCode ? `(${order.couponCode})` : ''}</span><span>− ₹ {discount}</span></div>
                )}
                {prepaidDiscount > 0 && (
                  <div><span>Prepaid discount</span><span>− ₹ {prepaidDiscount}</span></div>
                )}
                {pointsDiscount > 0 && (
                  <div><span>Reward points</span><span>− ₹ {pointsDiscount}</span></div>
                )}
                {giftCardApplied > 0 && (
                  <div><span>Gift card {order.giftCardCode ? `(${order.giftCardCode})` : ''}</span><span>− ₹ {giftCardApplied}</span></div>
                )}
              </div>

              <div className="invoice-total-band">
                <span>Total Amount</span>
                <b>₹ {order.total}</b>
              </div>
              <div className="invoice-amount-lines">
                <div><span>Received Amount</span><span>₹ {received}</span></div>
                {balanceDue > 0 && (
                  <div className="invoice-balance"><span>Balance Due</span><span>₹ {balanceDue}</span></div>
                )}
              </div>
            </div>
          </div>

          <div className="invoice-words">
            <span>Total Amount (in words)</span>
            <b>{amountInWords(order.total)}</b>
          </div>

          <div className="invoice-sign">
            <div className="invoice-sign-box">
              <span>For {settings.businessName}</span>
              {settings.signatureImage ? (
                <img className="invoice-sign-img" src={getProductImage(settings.signatureImage)} alt="" />
              ) : (
                <div className="invoice-sign-line" />
              )}
              <span>{settings.signatoryName}</span>
            </div>
          </div>

          <p className="invoice-note">
            Thank you for shopping with {settings.businessName} — wood-pressed with care, always.
          </p>
        </div>
      </div>
    </div>
  );
}
