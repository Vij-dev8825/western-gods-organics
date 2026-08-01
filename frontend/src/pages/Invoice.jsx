import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.svg';
import ChakkiWheel from '../components/ChakkiWheel';

const PAYMENT_LABELS = { cod: 'Cash on Delivery', razorpay: 'Paid Online (Razorpay)' };

export default function Invoice() {
  const { orderId } = useParams();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getOrder(token, orderId).then((d) => setOrder(d.order)).catch((e) => setError(e.message));
  }, [token, orderId]);

  if (error) {
    return (
      <div className="container section center">
        <p className="alert alert-error" style={{ display: 'inline-block' }}>{error}</p>
        <div><Link to="/orders" className="btn btn-gold">Back to my orders</Link></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  const subtotal = order.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const discount = order.discount || 0;
  const pointsDiscount = order.pointsRedeemed || 0; // 1 point = ₹1, see backend/utils/loyalty.js
  const giftCardApplied = order.giftCardApplied || 0;
  // Isolates shipping as whatever's left after every other known deduction —
  // has to account for all of them or a points/gift-card order would show
  // the wrong shipping fee here (the residual would silently absorb them).
  const shipping = order.total - subtotal + discount + pointsDiscount + giftCardApplied;
  // Orders placed before this existed have no shippingChoice — treat as the
  // default "shipping" (store-charged) path, same as they were charged.
  const isToPay = order.shippingChoice === 'to_pay';
  const showShippingRow = isToPay ? true : shipping > 0;
  const shippingLabel = isToPay ? 'To Pay' : 'Shipping';

  return (
    <div className="invoice-page">
      <div className="invoice-toolbar no-print">
        <Link to="/orders" className="link-btn">← Back to my orders</Link>
        <button className="btn btn-gold btn-sm" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <div className="invoice-sheet">
        <div className="invoice-header">
          <img src={logo} alt="Western Gods Organics" height={44} />
          <div className="invoice-header-address">
            <b>Shri Gopal Flour &amp; Oil Mills</b>
            <span>Udumalpet, Tiruppur District, Tamil Nadu – 642126</span>
            <span>westerngodsorganic@gmail.com · +91 88258 75607</span>
          </div>
        </div>

        <div className="invoice-title-row">
          <h2>Tax Invoice</h2>
          <div className="invoice-meta">
            <div><span>Invoice / Order #</span><b>{order.orderNumber}</b></div>
            <div><span>Date</span><b>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</b></div>
            <div><span>Payment</span><b>{PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</b></div>
            <div><span>Status</span><b style={{ textTransform: 'capitalize' }}>{order.status}</b></div>
          </div>
        </div>

        <div className="invoice-address-block">
          <span className="eyebrow">Deliver to</span>
          <p style={{ margin: 0 }}>
            {order.address.line1}<br />
            {order.address.city}, {order.address.state} – {order.address.pincode}<br />
            Phone: {order.address.phone}
          </p>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Size</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{it.name}</td>
                <td>{it.size}</td>
                <td>{it.quantity}</td>
                <td>₹{it.price}</td>
                <td>₹{it.price * it.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-totals">
          <div><span>Subtotal</span><span>₹{subtotal}</span></div>
          {showShippingRow && (
            <div><span>{shippingLabel}</span><span>{isToPay ? 'At delivery' : `₹${shipping}`}</span></div>
          )}
          {discount > 0 && (
            <div><span>Coupon {order.couponCode ? `(${order.couponCode})` : ''}</span><span>−₹{discount}</span></div>
          )}
          {pointsDiscount > 0 && (
            <div><span>Reward points</span><span>−₹{pointsDiscount}</span></div>
          )}
          {giftCardApplied > 0 && (
            <div><span>Gift card {order.giftCardCode ? `(${order.giftCardCode})` : ''}</span><span>−₹{giftCardApplied}</span></div>
          )}
          <div className="invoice-total-grand"><span>Total</span><span>₹{order.total}</span></div>
        </div>

        <div className="invoice-footer">
          <p>Thank you for shopping with Western Gods Organics — wood-pressed with care, always.</p>
          <p className="muted">This is a computer-generated invoice and does not require a signature.</p>
        </div>
      </div>
    </div>
  );
}
