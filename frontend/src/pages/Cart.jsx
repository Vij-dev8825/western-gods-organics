import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { getProductImage } from '../utils/productImages';
import { loadRazorpay } from '../utils/loadRazorpay';
import { validateAddress } from '../utils/validators';
import ChakkiWheel from '../components/ChakkiWheel';

export default function Cart() {
  const { items, updateQuantity, removeItem, clearCart } = useCart();
  const { isLoggedIn, token, user } = useAuth();
  const { showToast } = useToast();
  const { isForeign, checkMinOrder, country } = useCurrency();
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
  const [addressErrors, setAddressErrors] = useState({});
  const [cityOptions, setCityOptions] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);
  const [pincodeLookupError, setPincodeLookupError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' | 'razorpay'
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [buyNowQty, setBuyNowQty] = useState(buyNowItem?.quantity || 1);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discount, subtotalAtApply }
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  useEffect(() => {
    api.getProducts().then((d) => setProducts(d.products));
    api.getConfig().then((d) => setRazorpayEnabled(!!d.razorpayEnabled)).catch(() => {});
  }, []);

  // Prefill from the last saved address so returning customers don't have
  // to retype it every order.
  useEffect(() => {
    if (user?.addresses?.[0]) setAddress(user.addresses[0]);
  }, [user]);

  // Look up city/state options from the pincode once it's 6 digits, so the
  // customer picks from a dropdown instead of typing them (and can't typo a
  // city/state that doesn't match their pincode).
  useEffect(() => {
    if (!/^\d{6}$/.test(address.pincode)) {
      setCityOptions([]);
      setStateOptions([]);
      setPincodeLookupError('');
      return;
    }
    let cancelled = false;
    api
      .lookupPincode(address.pincode)
      .then((d) => {
        if (cancelled) return;
        setCityOptions(d.cities);
        setStateOptions(d.states);
        setPincodeLookupError('');
        setAddress((a) => ({
          ...a,
          city: d.cities.includes(a.city) ? a.city : d.cities[0] || '',
          state: d.states.includes(a.state) ? a.state : d.states[0] || '',
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setCityOptions([]);
        setStateOptions([]);
        setPincodeLookupError("Couldn't look up this pincode — enter city/state manually.");
      });
    return () => {
      cancelled = true;
    };
  }, [address.pincode]);

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
  const couponStale = appliedCoupon && appliedCoupon.subtotalAtApply !== subtotal;
  const discount = appliedCoupon && !couponStale ? appliedCoupon.discount : 0;
  const total = subtotal + shipping - discount;
  const minOrderCheck = checkMinOrder(subtotal);

  function updateAddress(field, value) {
    setAddress((a) => ({ ...a, [field]: value }));
    setAddressErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
  }

  async function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setApplyingCoupon(true);
    setCouponError('');
    try {
      const res = await api.validateCoupon(token, { code, subtotal });
      setAppliedCoupon({ code: res.code, discount: res.discount, subtotalAtApply: subtotal });
      showToast(`Coupon "${res.code}" applied — you saved ₹${res.discount}.`);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message);
    } finally {
      setApplyingCoupon(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError('');
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();
    if (!minOrderCheck.met) {
      showToast(`Minimum order for ${country.label} is ${minOrderCheck.minFormatted}.`, 'error');
      return;
    }
    const errors = validateAddress(address);
    setAddressErrors(errors);
    if (Object.keys(errors).length) {
      showToast('Please fix the highlighted fields in your delivery address.', 'error');
      return;
    }
    setPlacing(true);
    const orderItems = lines.map((l) => ({ productId: l.productId, size: l.size, quantity: l.quantity }));
    const couponCode = !couponStale && appliedCoupon ? appliedCoupon.code : undefined;
    try {
      if (paymentMethod === 'razorpay') {
        await payWithRazorpay(orderItems, couponCode);
      } else {
        const data = await api.placeOrder(token, { items: orderItems, address, paymentMethod: 'cod', couponCode });
        if (!isBuyNow) clearCart();
        api.updateProfile(token, { addresses: [address] }).catch(() => {});
        navigate(`/order-success/${data.order.id}`);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPlacing(false);
    }
  }

  async function payWithRazorpay(orderItems, couponCode) {
    const rzpOrder = await api.createRazorpayOrder(token, { items: orderItems, couponCode });
    await loadRazorpay();

    return new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: rzpOrder.keyId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        order_id: rzpOrder.razorpayOrderId,
        name: 'Western Gods Organics',
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
            const data = await api.verifyRazorpayPayment(token, { items: orderItems, address, couponCode, ...response });
            if (!isBuyNow) clearCart();
            api.updateProfile(token, { addresses: [address] }).catch(() => {});
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
      {isForeign && (
        <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
          Prices below are shown in ₹ (INR) — the currency you'll actually be charged, regardless of the reference price shown while browsing.
        </p>
      )}

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
          {discount > 0 && (
            <div className="summary-row" style={{ color: '#1e6b34' }}>
              <span>Coupon ({appliedCoupon.code})</span><span>−₹{discount}</span>
            </div>
          )}
          <div className="summary-row total"><span>Total</span><span>₹{total}</span></div>

          <div className="coupon-field">
            {appliedCoupon && !couponStale ? (
              <div className="coupon-applied">
                <span>
                  🎉 <b>{appliedCoupon.code}</b> applied
                </span>
                <button type="button" className="link-btn" onClick={removeCoupon}>Remove</button>
              </div>
            ) : (
              <>
                <div className="flex gap-1">
                  <input
                    placeholder="Coupon code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={!couponInput.trim() || applyingCoupon}
                    onClick={handleApplyCoupon}
                  >
                    {applyingCoupon ? 'Applying…' : 'Apply'}
                  </button>
                </div>
                {couponStale && <div className="field-error">Your cart changed — apply the code again.</div>}
                {couponError && <div className="field-error">{couponError}</div>}
              </>
            )}
          </div>

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
            <form onSubmit={handlePlaceOrder} style={{ marginTop: 18 }} noValidate>
              <div className="checkout-step">
                <span className="checkout-step-num">1</span>
                <h4>Delivery Address</h4>
              </div>
              {user?.addresses?.[0] && (
                <p className="muted" style={{ fontSize: '0.82rem', marginTop: -8 }}>
                  Filled in from your saved address — edit any field if it's changed.
                </p>
              )}
              <div className="field">
                <label>Address line</label>
                <input
                  required
                  value={address.line1}
                  onChange={(e) => updateAddress('line1', e.target.value)}
                />
                {addressErrors.line1 && <div className="field-error">{addressErrors.line1}</div>}
              </div>
              <div className="field">
                <label>Pincode</label>
                <input
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={address.pincode}
                  onChange={(e) => updateAddress('pincode', e.target.value.replace(/\D/g, ''))}
                />
                {addressErrors.pincode && <div className="field-error">{addressErrors.pincode}</div>}
                {pincodeLookupError && <div className="field-error">{pincodeLookupError}</div>}
              </div>
              <div className="field">
                <label>City</label>
                {cityOptions.length > 0 ? (
                  <select value={address.city} onChange={(e) => updateAddress('city', e.target.value)}>
                    {cityOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    value={address.city}
                    onChange={(e) => updateAddress('city', e.target.value)}
                    placeholder="Enter your 6-digit pincode above to auto-fill"
                  />
                )}
                {addressErrors.city && <div className="field-error">{addressErrors.city}</div>}
              </div>
              <div className="field">
                <label>State</label>
                {stateOptions.length > 0 ? (
                  <select value={address.state} onChange={(e) => updateAddress('state', e.target.value)}>
                    {stateOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    value={address.state}
                    onChange={(e) => updateAddress('state', e.target.value)}
                    placeholder="Enter your 6-digit pincode above to auto-fill"
                  />
                )}
                {addressErrors.state && <div className="field-error">{addressErrors.state}</div>}
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={address.phone}
                  onChange={(e) => updateAddress('phone', e.target.value.replace(/\D/g, ''))}
                />
                {addressErrors.phone && <div className="field-error">{addressErrors.phone}</div>}
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

              {!minOrderCheck.met && (
                <div className="alert alert-error" style={{ marginTop: 16 }}>
                  Minimum order for {country.label} is {minOrderCheck.minFormatted} — add{' '}
                  {minOrderCheck.shortfallFormatted} more to continue.
                </div>
              )}

              <div className="cart-cta-bar">
                <div className="cart-cta-total">
                  <span className="muted">Total</span>
                  <b>₹{total}</b>
                </div>
                <button className="btn btn-gold btn-block" style={{ marginTop: 18 }} disabled={placing || !minOrderCheck.met}>
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
