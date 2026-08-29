import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { IconCheck } from '../components/Icons';
import ChakkiWheel from '../components/ChakkiWheel';
import Confetti from '../components/Confetti';
import SeoMeta from '../components/SeoMeta';

const PAYMENT_LABELS = { cod: 'Cash on Delivery', razorpay: 'Paid Online (Razorpay)' };

export default function OrderSuccess() {
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
        <div><Link to="/orders" className="btn btn-gold">Go to my orders</Link></div>
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

  const delivery = new Date(order.createdAt);
  delivery.setDate(delivery.getDate() + 5);

  return (
    <div className="container section order-success-page">
      <SeoMeta
        title="Order Confirmed — Western Gods Organics"
        description="Your order has been placed successfully — view your order number, payment status, estimated delivery date and delivery address."
        path={`/order-success/${order.id}`}
        robots="noindex"
      />
      <Confetti key={order.id} />
      <div className="order-success-card">
        <div className="order-success-check">
          <IconCheck size={34} />
        </div>
        <h2>Order placed successfully!</h2>
        <p className="muted">
          Thank you for shopping with us — we've received your order and will call to confirm delivery.
        </p>

        <div className="order-success-meta">
          <div>
            <span className="muted">Order number</span>
            <b>{order.orderNumber}</b>
          </div>
          <div>
            <span className="muted">Payment</span>
            <b>{PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</b>
          </div>
          <div>
            <span className="muted">Estimated delivery</span>
            <b>
              {delivery.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </b>
          </div>
        </div>

        <div className="order-success-items">
          {order.items.map((it, i) => (
            <div key={i} className="flex-between" style={{ fontSize: '0.9rem', padding: '6px 0' }}>
              <span>{it.name} ({it.size}) × {it.quantity}</span>
              <span>₹{it.price * it.quantity}</span>
            </div>
          ))}
          {order.discount > 0 && (
            <div className="flex-between" style={{ fontSize: '0.9rem', padding: '6px 0', color: '#1e6b34' }}>
              <span>Coupon {order.couponCode ? `(${order.couponCode})` : ''}</span>
              <span>−₹{order.discount}</span>
            </div>
          )}
          <div className="summary-row total" style={{ marginTop: 6 }}>
            <span>Total</span><span>₹{order.total}</span>
          </div>
        </div>

        <div className="order-success-address">
          <span className="eyebrow">Delivering to</span>
          <p style={{ margin: 0 }}>
            {order.address.line1}, {order.address.city}, {order.address.state} – {order.address.pincode}
          </p>
        </div>

        <div className="order-success-actions">
          <Link to="/orders" className="btn btn-forest">View my orders</Link>
          <Link to={`/invoice/${order.id}`} className="btn btn-outline">Get invoice</Link>
          <Link to="/shop" className="btn btn-gold">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
