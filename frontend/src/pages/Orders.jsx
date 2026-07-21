import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { getProductImage } from '../utils/productImages';
import ChakkiWheel from '../components/ChakkiWheel';
import OrderTracker from '../components/OrderTracker';

const STATUS_LABELS = {
  placed: 'Order Placed',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const CANCELLABLE_STATUSES = ['placed', 'confirmed'];

export default function Orders() {
  const { token } = useAuth();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState(null);
  const [products, setProducts] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    api.getOrders(token).then((d) => setOrders(d.orders)).catch(() => setOrders([]));
    api.getProducts().then((d) => setProducts(d.products)).catch(() => {});
  }, [token]);

  function imageFor(productId) {
    const p = products.find((pr) => pr.id === productId);
    return getProductImage(p?.image);
  }

  function handleBuyAgain(order) {
    order.items.forEach((it) => addItem(it.productId, it.size, it.quantity));
    showToast(`${order.items.length} item(s) added to your cart.`);
    navigate('/cart');
  }

  async function handleCancel(order) {
    if (!window.confirm(`Cancel order #${order.orderNumber}? This can't be undone.`)) return;
    setCancellingId(order.id);
    try {
      const { order: updated } = await api.cancelOrder(token, order.id);
      setOrders((os) => os.map((o) => (o.id === updated.id ? updated : o)));
      showToast(
        order.paymentMethod === 'razorpay'
          ? 'Order cancelled. Your refund will be processed within 5-7 business days.'
          : 'Order cancelled.'
      );
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setCancellingId(null);
    }
  }

  if (orders === null) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="breadcrumb">Home / My Orders</div>
      <div className="section-head">
        <div>
          <span className="eyebrow">My Account</span>
          <h2>My Orders</h2>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state">
          <ChakkiWheel size={70} spin={false} />
          <h3>No orders yet</h3>
          <p className="muted">Your placed orders will show up here.</p>
          <Link to="/shop" className="btn btn-gold">Start shopping</Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((o) => (
              <div key={o.id} className="order-card">
                <div className="order-card-head">
                  <div>
                    <span className={`status-pill status-${o.status}`}>{STATUS_LABELS[o.status] || o.status}</span>
                    <h3 style={{ margin: '8px 0 2px' }}>Order #{o.orderNumber}</h3>
                    <span className="muted" style={{ fontSize: '0.82rem' }}>
                      Placed on{' '}
                      {new Date(o.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="order-card-total">
                    <span className="muted">Total</span>
                    <b>₹{o.total}</b>
                  </div>
                </div>

                <OrderTracker status={o.status} />

                <div className="order-items-row">
                  <div className="order-item-thumbs">
                    {o.items.slice(0, 4).map((it, i) => (
                      <div className="order-item-thumb" key={i} title={`${it.name} (${it.size}) × ${it.quantity}`}>
                        <img src={imageFor(it.productId)} alt={it.name} />
                      </div>
                    ))}
                    {o.items.length > 4 && <span className="order-item-more">+{o.items.length - 4}</span>}
                  </div>
                  <div className="order-items-summary muted">
                    {o.items
                      .slice(0, 2)
                      .map((it) => `${it.name} (${it.size}) × ${it.quantity}`)
                      .join(', ')}
                    {o.items.length > 2 ? `, +${o.items.length - 2} more item(s)` : ''}
                  </div>
                </div>

                <div className="order-card-actions">
                  <button className="btn btn-forest btn-sm" onClick={() => handleBuyAgain(o)}>
                    Buy Again
                  </button>
                  <Link to={`/invoice/${o.id}`} className="btn btn-outline btn-sm">
                    Invoice
                  </Link>
                  {CANCELLABLE_STATUSES.includes(o.status) && (
                    <button
                      className="btn btn-outline btn-danger btn-sm"
                      disabled={cancellingId === o.id}
                      onClick={() => handleCancel(o)}
                    >
                      {cancellingId === o.id ? 'Cancelling…' : 'Cancel Order'}
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
