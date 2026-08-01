import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { getProductImage } from '../utils/productImages';
import { loadRazorpay } from '../utils/loadRazorpay';
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
const RETURN_WINDOW_DAYS = 7;
const RETURN_REASONS = [
  { value: 'damaged-incorrect', label: 'Damaged or incorrect item' },
  { value: 'quality-issue', label: "Doesn't meet quality promise" },
  { value: 'other', label: 'Other' },
];
const RETURN_STATUS_LABELS = {
  requested: 'Return Requested',
  approved: 'Return Approved',
  rejected: 'Return Rejected',
  refunded: 'Refunded',
};
const BOTTLE_RETURN_STATUS_LABELS = {
  requested: 'Bottle Return Requested',
  approved: 'Bottle Credit Issued',
  rejected: 'Bottle Return Rejected',
};

function canRequestReturn(order) {
  if (order.status !== 'delivered' || order.returnRequest) return false;
  if (!order.deliveredAt) return true;
  const daysSinceDelivery = (Date.now() - new Date(order.deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceDelivery <= RETURN_WINDOW_DAYS;
}

// How many oil-bottle units this order could still have a return requested
// for — only "oils" ship in the reusable glass bottles this program is for.
function maxReturnableBottles(order, products) {
  const oilProductIds = new Set(products.filter((p) => p.category === 'oils').map((p) => p.id));
  return order.items.filter((it) => oilProductIds.has(it.productId)).reduce((sum, it) => sum + it.quantity, 0);
}

function canReturnBottle(order, products) {
  return order.status === 'delivered' && !order.bottleReturn && maxReturnableBottles(order, products) > 0;
}

export default function Orders() {
  const { token } = useAuth();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState(null);
  const [products, setProducts] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [returnFormId, setReturnFormId] = useState(null);
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0].value);
  const [returnDescription, setReturnDescription] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [bottleFormId, setBottleFormId] = useState(null);
  const [bottleQty, setBottleQty] = useState(1);
  const [submittingBottle, setSubmittingBottle] = useState(false);
  const [qrOrderId, setQrOrderId] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);

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

  function canPayOnline(order) {
    return order.paymentMethod !== 'razorpay' && order.paymentStatus !== 'paid' && CANCELLABLE_STATUSES.includes(order.status);
  }

  async function handlePayOnline(order) {
    setPayingId(order.id);
    try {
      const rzpOrder = await api.createOrderPayment(token, order.id);
      await loadRazorpay();
      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: rzpOrder.keyId,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          order_id: rzpOrder.razorpayOrderId,
          name: 'Western Gods Organics',
          description: `Order #${order.orderNumber}`,
          prefill: { contact: order.address.phone },
          theme: { color: '#6fae4f' },
          modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
          handler: async (response) => {
            try {
              const { order: updated } = await api.verifyOrderPayment(token, order.id, response);
              setOrders((os) => os.map((o) => (o.id === updated.id ? updated : o)));
              showToast('Payment successful — this order is now marked as paid online.');
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        });
        rzp.on('payment.failed', () => reject(new Error('Payment failed. Please try again.')));
        rzp.open();
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPayingId(null);
    }
  }

  function openReturnForm(orderId) {
    setReturnFormId(orderId);
    setReturnReason(RETURN_REASONS[0].value);
    setReturnDescription('');
  }

  async function handleSubmitReturn(order) {
    if (returnDescription.trim().length < 10) {
      showToast('Please describe the issue (at least 10 characters).', 'error');
      return;
    }
    setSubmittingReturn(true);
    try {
      const { order: updated } = await api.requestReturn(token, order.id, {
        reason: returnReason,
        description: returnDescription,
      });
      setOrders((os) => os.map((o) => (o.id === updated.id ? updated : o)));
      setReturnFormId(null);
      showToast("Return request submitted — we'll review it shortly.");
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingReturn(false);
    }
  }

  function openBottleForm(order) {
    setBottleFormId(order.id);
    setBottleQty(1);
  }

  async function handleSubmitBottleReturn(order) {
    setSubmittingBottle(true);
    try {
      const { order: updated } = await api.requestBottleReturn(token, order.id, bottleQty);
      setOrders((os) => os.map((o) => (o.id === updated.id ? updated : o)));
      setBottleFormId(null);
      showToast("Bottle return requested — we'll review it and send your refill credit shortly.");
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingBottle(false);
    }
  }

  // A QR label the customer can attach to the physical package — scanning it
  // takes admin straight to this specific request in Admin → Bottle Returns
  // instead of hunting through the list on receipt.
  async function toggleQr(order) {
    if (qrOrderId === order.id) {
      setQrOrderId(null);
      return;
    }
    setLoadingQr(true);
    try {
      const d = await api.getBottleReturnQr(token, order.id);
      setQrDataUrl(d.qr);
      setQrOrderId(order.id);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingQr(false);
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
                    {o.paymentMethod === 'cod_advance' && (
                      <span className="muted" style={{ display: 'block', fontSize: '0.78rem' }}>
                        ₹{o.advancePaid} paid · ₹{o.total - o.advancePaid} due on delivery
                      </span>
                    )}
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
                  {canPayOnline(o) && (
                    <button
                      className="btn btn-gold btn-sm"
                      disabled={payingId === o.id}
                      onClick={() => handlePayOnline(o)}
                    >
                      {payingId === o.id
                        ? 'Opening…'
                        : o.paymentMethod === 'cod_advance'
                        ? `Pay remaining ₹${o.total - o.advancePaid}`
                        : 'Pay Online'}
                    </button>
                  )}
                  {CANCELLABLE_STATUSES.includes(o.status) && (
                    <button
                      className="btn btn-outline btn-danger btn-sm"
                      disabled={cancellingId === o.id}
                      onClick={() => handleCancel(o)}
                    >
                      {cancellingId === o.id ? 'Cancelling…' : 'Cancel Order'}
                    </button>
                  )}
                  {canRequestReturn(o) && returnFormId !== o.id && (
                    <button className="btn btn-outline btn-sm" onClick={() => openReturnForm(o.id)}>
                      Request Return
                    </button>
                  )}
                  {o.returnRequest && (
                    <span className={`status-pill status-${o.returnRequest.status}`}>
                      {RETURN_STATUS_LABELS[o.returnRequest.status] || o.returnRequest.status}
                    </span>
                  )}
                  {canReturnBottle(o, products) && bottleFormId !== o.id && (
                    <button className="btn btn-outline btn-sm" onClick={() => openBottleForm(o)}>
                      ♻️ Return bottle for credit
                    </button>
                  )}
                  {o.bottleReturn && (
                    <span className={`status-pill status-${o.bottleReturn.status}`}>
                      {BOTTLE_RETURN_STATUS_LABELS[o.bottleReturn.status] || o.bottleReturn.status}
                    </span>
                  )}
                  {o.bottleReturn?.status === 'requested' && (
                    <button className="btn btn-outline btn-sm" disabled={loadingQr} onClick={() => toggleQr(o)}>
                      {qrOrderId === o.id ? 'Hide return label' : '📦 Show return label'}
                    </button>
                  )}
                </div>

                {qrOrderId === o.id && qrDataUrl && (
                  <div className="return-request-form center">
                    <p className="muted" style={{ marginTop: 0 }}>
                      Attach this to your package — scanning it takes us straight to your return on receipt.
                    </p>
                    <img src={qrDataUrl} alt="Bottle return QR code" style={{ width: 180, height: 180 }} />
                  </div>
                )}

                {returnFormId === o.id && (
                  <div className="return-request-form">
                    <div className="field">
                      <label>Reason</label>
                      <select className="select" value={returnReason} onChange={(e) => setReturnReason(e.target.value)}>
                        {RETURN_REASONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Describe the issue</label>
                      <textarea
                        rows={3}
                        value={returnDescription}
                        onChange={(e) => setReturnDescription(e.target.value)}
                        placeholder="Tell us what's wrong so we can review your request…"
                      />
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="btn btn-gold btn-sm"
                        disabled={submittingReturn}
                        onClick={() => handleSubmitReturn(o)}
                      >
                        {submittingReturn ? 'Submitting…' : 'Submit Request'}
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => setReturnFormId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {bottleFormId === o.id && (
                  <div className="return-request-form">
                    <div className="field">
                      <label>How many bottles are you returning?</label>
                      <input
                        type="number"
                        className="input"
                        min={1}
                        max={maxReturnableBottles(o, products)}
                        value={bottleQty}
                        onChange={(e) =>
                          setBottleQty(Math.min(Math.max(1, Number(e.target.value) || 1), maxReturnableBottles(o, products)))
                        }
                      />
                      <span className="muted" style={{ fontSize: '0.8rem' }}>
                        Up to {maxReturnableBottles(o, products)} eligible from this order · ₹20 credit per bottle
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="btn btn-gold btn-sm"
                        disabled={submittingBottle}
                        onClick={() => handleSubmitBottleReturn(o)}
                      >
                        {submittingBottle ? 'Submitting…' : 'Submit Request'}
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => setBottleFormId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
