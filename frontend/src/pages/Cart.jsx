import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getProductImage } from '../utils/productImages';
import { loadRazorpay } from '../utils/loadRazorpay';
import ChakkiWheel from '../components/ChakkiWheel';

export default function Cart() {
  const { items, updateQuantity, removeItem, clearCart } = useCart();
  const { isLoggedIn, token, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // "Buy Now" bypasses the persisted cart entirely — a single item passed via
  // router state (from Product Detail / product cards), checked out on its
  // own without touching whatever is already in the customer's real cart.
  const buyNowItem = location.state?.buyNow || null;
  const isBuyNow = !!buyNowItem;

  const [products, setProducts] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [address, setAddress] = useState({ line1: '', city: '', state: '', pincode: '', phone: '' });
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' | 'razorpay'
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [buyNowQty, setBuyNowQty] = useState(buyNowItem?.quantity || 1);

  useEffect(() => {
    api.getProducts().then((d) => setProducts(d.products));
    api.getConfig().then((d) => setRazorpayEnabled(!!d.razorpayEnabled)).catch(() => {});
  }, []);

  const lines = useMemo(() => {
    if (isBuyNow) {
      const product = products.find((p) => p.id === buyNowItem.productId);
      if (!product) return [];
      const sizeInfo = product.sizes.find((s) => s.label === buyNowItem.size);
      if (!sizeInfo) return [];
      return [{ productId: buyNowItem.productId, size: buyNowItem.size, quantity: buyNowQty, product, sizeInfo }];
    }
    return items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return null;
        const sizeInfo = product.sizes.find((s) => s.label === item.size);
        return { ...item, product, sizeInfo };
      })
      .filter(Boolean);
  }, [items, products, isBuyNow, buyNowItem, buyNowQty]);

  const subtotal = lines.reduce((sum, l) => sum + l.sizeInfo.price * l.quantity, 0);
  const shipping = subtotal > 999 || subtotal === 0 ? 0 : 60;
  const total = subtotal + shipping;

  function validAddress() {
    return address.line1 && address.city && address.state && address.pincode && address.phone;
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();
    if (!validAddress()) {
      showToast('Please fill in your complete delivery address.', 'error');
      return;
    }
    setPlacing(true);
    const orderItems = lines.map((l) => ({ productId: l.productId, size: l.size, quantity: l.quantity }));
    try {
      if (paymentMethod === 'razorpay') {
        await payWithRazorpay(orderItems);
      } else {
        const data = await api.placeOrder(token, { items: orderItems, address, paymentMethod: 'cod' });
        if (!isBuyNow) clearCart();
        navigate(`/order-success/${data.order.id}`);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPlacing(false);
    }
  }

  async function payWithRazorpay(orderItems) {
    const rzpOrder = await api.createRazorpayOrder(token, orderItems);
    await loadRazorpay();

    return new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: rzpOrder.keyId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        order_id: rzpOrder.razorpayOrderId,
        name: 'Yamuna Organic',
        description: `Order · ${orderItems.length} item(s)`,
        prefill: {
          name: user?.name || '',
          contact: address.phone,
        },
        theme: { color: '#6fae4f' },
        modal: {
          ondismiss: () => {
            setPlacing(false);
            reject(new Error('Payment cancelled.'));
          },
        },
        handler: async (response) => {
          try {
            const data = await api.verifyRazorpayPayment(token, { items: orderItems, address, ...response });
            if (!isBuyNow) clearCart();
            navigate(`/order-success/${data.order.id}`);
            resolve();
          } catch (err) {
            showToast(err.message, 'error');
            reject(err);
          }
        },
      });
      rzp.on('payment.failed', () => {
        setPlacing(false);
        reject(new Error('Payment failed. Please try again or choose Cash on Delivery.'));
      });
      rzp.open();
    });
  }

  if (!products.length && (items.length || isBuyNow)) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  if (!isBuyNow && !items.length) {
    return (
      <div className="container">
        <div className="empty-state">
          <ChakkiWheel size={70} spin={false} />
          <h2>Your cart is empty</h2>
          <p className="muted">Add some cold-pressed goodness to get started.</p>
          <Link to="/shop" className="btn btn-gold">Browse the shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="breadcrumb">Home / {isBuyNow ? 'Buy Now' : 'Cart'}</div>
      <h2>{isBuyNow ? 'Buy Now' : 'Your Cart'}</h2>

      <div className="cart-layout">
        <div>
          {lines.map((l) => (
            <div className="cart-line" key={`${l.productId}-${l.size}`}>
              <img src={getProductImage(l.product.image)} alt={l.product.name} />
              <div className="cart-line-details">
                <h3 style={{ marginBottom: 4 }}>{l.product.name}</h3>
                <span className="muted" style={{ fontSize: '0.85rem' }}>Size: {l.size}</span>
                {!isBuyNow && (
                  <div>
                    <button
                      className="btn-sm btn-ghost btn"
                      style={{ marginTop: 8 }}
                      onClick={() => removeItem(l.productId, l.size)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {isBuyNow ? (
                <div className="qty-stepper">
                  <button onClick={() => setBuyNowQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
                  <span>{l.quantity}</span>
                  <button onClick={() => setBuyNowQty((q) => q + 1)} aria-label="Increase quantity">+</button>
                </div>
              ) : (
                <div className="qty-stepper">
                  <button onClick={() => updateQuantity(l.productId, l.size, l.quantity - 1)} aria-label="Decrease quantity">−</button>
                  <span>{l.quantity}</span>
                  <button onClick={() => updateQuantity(l.productId, l.size, l.quantity + 1)} aria-label="Increase quantity">+</button>
                </div>
              )}
              <div className="price" style={{ fontFamily: 'var(--font-mono)' }}>
                ₹{l.sizeInfo.price * l.quantity}
              </div>
            </div>
          ))}
          {isBuyNow && (
            <Link to="/cart" className="link-btn" style={{ marginTop: 12, display: 'inline-block' }}>
              ← Go to your full cart instead
            </Link>
          )}
        </div>

        <div className="summary-card">
          <h3>Order Summary</h3>
          <div className="summary-row"><span>Subtotal</span><span>₹{subtotal}</span></div>
          <div className="summary-row">
            <span>Shipping</span><span>{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
          </div>
          <div className="summary-row total"><span>Total</span><span>₹{total}</span></div>

          {!showAddressForm ? (
            <div className="cart-cta-bar">
              <div className="cart-cta-total">
                <span className="muted">Total</span>
                <b>₹{total}</b>
              </div>
              <button
                className="btn btn-gold btn-block"
                style={{ marginTop: 18 }}
                onClick={() => {
                  if (!isLoggedIn) {
                    navigate('/login', { state: { from: '/cart', buyNow: buyNowItem || undefined } });
                    return;
                  }
                  setShowAddressForm(true);
                }}
              >
                {isLoggedIn ? 'Proceed to checkout' : 'Log in to checkout'}
              </button>
            </div>
          ) : (
            <form onSubmit={handlePlaceOrder} style={{ marginTop: 18 }}>
              <div className="checkout-step">
                <span className="checkout-step-num">1</span>
                <h4>Delivery Address</h4>
              </div>
              <div className="field">
                <label>Address line</label>
                <input required value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} />
              </div>
              <div className="field">
                <label>City</label>
                <input required value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
              </div>
              <div className="field">
                <label>State</label>
                <input required value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
              </div>
              <div className="field">
                <label>Pincode</label>
                <input required value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value })} />
              </div>
              <div className="field">
                <label>Phone</label>
                <input required value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
              </div>

              <div className="checkout-step" style={{ marginTop: 22 }}>
                <span className="checkout-step-num">2</span>
                <h4>Payment Method</h4>
              </div>
              <div className="payment-options">
                <label className={`payment-option ${paymentMethod === 'cod' ? 'active' : ''}`}>
                  <input type="radio" name="paymentMethod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                  <span className="filter-radio" aria-hidden="true" />
                  <span className="payment-option-body">
                    <b>Cash on Delivery</b>
                    <span className="muted">Pay in cash when your order arrives</span>
                  </span>
                </label>
                <label className={`payment-option ${paymentMethod === 'razorpay' ? 'active' : ''} ${!razorpayEnabled ? 'disabled' : ''}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === 'razorpay'}
                    disabled={!razorpayEnabled}
                    onChange={() => setPaymentMethod('razorpay')}
                  />
                  <span className="filter-radio" aria-hidden="true" />
                  <span className="payment-option-body">
                    <b>Pay Online</b>
                    <span className="muted">
                      {razorpayEnabled
                        ? 'Cards, UPI, NetBanking & wallets — secured by Razorpay'
                        : 'Currently unavailable — please use Cash on Delivery'}
                    </span>
                  </span>
                </label>
              </div>

              <div className="cart-cta-bar">
                <div className="cart-cta-total">
                  <span className="muted">Total</span>
                  <b>₹{total}</b>
                </div>
                <button className="btn btn-gold btn-block" style={{ marginTop: 18 }} disabled={placing}>
                  {placing ? 'Processing…' : paymentMethod === 'razorpay' ? 'Pay securely' : 'Place order'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
