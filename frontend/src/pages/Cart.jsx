import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { getProductImage } from '../utils/productImages';
import { loadRazorpay } from '../utils/loadRazorpay';
import { validateAddress, isValidEmail } from '../utils/validators';
import { normalizeAddresses } from '../utils/addresses';
import { getEffectivePrice } from '../utils/pricing';
import { getAttributedAffiliateCode } from '../utils/affiliateAttribution';
import ChakkiWheel from '../components/ChakkiWheel';
import AddressForm from '../components/AddressForm';
import CodPhoneVerify from '../components/CodPhoneVerify';

function validateGuestInfo(name, email) {
  const errors = {};
  if (!name || name.trim().length < 2) errors.name = 'Enter your name.';
  if (email && !isValidEmail(email)) errors.email = 'Enter a valid email address, or leave it blank.';
  return errors;
}

export default function Cart() {
  const { items, updateQuantity, removeItem, clearCart } = useCart();
  const { isLoggedIn, token, user, login } = useAuth();
  const { showToast } = useToast();
  const { isForeign, checkMinOrder, getShippingFee, country } = useCurrency();
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
  const [address, setAddress] = useState({ line1: '', city: '', state: '', pincode: '', phone: '', country: country.code });
  const [addressErrors, setAddressErrors] = useState({});
  const [selectedAddressId, setSelectedAddressId] = useState('new');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestErrors, setGuestErrors] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' | 'razorpay' | 'cod_advance'
  const [shippingChoice, setShippingChoice] = useState('shipping'); // 'shipping' | 'to_pay'
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [codVerifiedPhone, setCodVerifiedPhone] = useState(null);
  const [buyNowQty, setBuyNowQty] = useState(buyNowItem?.quantity || 1);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discount, subtotalAtApply }
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [loyaltyTier, setLoyaltyTier] = useState(null);
  const [giftCardInput, setGiftCardInput] = useState('');
  const [appliedGiftCard, setAppliedGiftCard] = useState(null); // { code, balance }
  const [giftCardError, setGiftCardError] = useState('');
  const [applyingGiftCard, setApplyingGiftCard] = useState(false);
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [affiliateInput, setAffiliateInput] = useState('');
  const [appliedAffiliateCode, setAppliedAffiliateCode] = useState(null);
  const [affiliateError, setAffiliateError] = useState('');
  const [applyingAffiliate, setApplyingAffiliate] = useState(false);

  const [codAdvanceInr, setCodAdvanceInr] = useState(0);
  const [enabledMethods, setEnabledMethods] = useState({ cod: true, razorpay: true, codAdvance: true });

  useEffect(() => {
    api.getProducts().then((d) => setProducts(d.products));
    api.getConfig().then((d) => {
      setRazorpayEnabled(!!d.razorpayEnabled);
      setCodAdvanceInr(d.codAdvanceInr || 0);
      if (d.paymentMethods) {
        setEnabledMethods(d.paymentMethods);
        // Falls back off the default 'cod' selection if an admin has turned
        // it off, so the form never submits a method that isn't offered.
        if (!d.paymentMethods.cod) {
          setPaymentMethod((pm) => (pm === 'cod' && d.paymentMethods.razorpay ? 'razorpay' : pm));
        }
      }
    }).catch(() => {});
  }, []);

  // Silently pre-fills and validates whatever affiliate code was captured
  // from a `?aff=` link earlier in this visit (see utils/affiliateAttribution)
  // — the customer doesn't have to remember or retype anything themselves.
  useEffect(() => {
    const captured = getAttributedAffiliateCode();
    if (!captured) return;
    setAffiliateInput(captured);
    api.validateAffiliateCode(token, captured).then((res) => setAppliedAffiliateCode(res.code)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    api.getLoyalty(token).then((d) => { setPointsBalance(d.balance); setLoyaltyTier(d.tier); }).catch(() => {});
  }, [isLoggedIn, token]);

  // Prefill from the default saved address so returning customers don't have
  // to retype it every order. Addresses saved before this field existed
  // won't have one — default to the current browsing country instead of
  // leaving it undefined (which would silently price shipping as domestic
  // regardless of what's selected up top).
  useEffect(() => {
    const addresses = normalizeAddresses(user?.addresses);
    if (addresses.length) {
      const def = addresses.find((a) => a.isDefault) || addresses[0];
      setSelectedAddressId(def.id);
      setAddress({ ...def, country: def.country || country.code });
    } else {
      setSelectedAddressId('new');
    }
  }, [user]);

  function selectSavedAddress(a) {
    setSelectedAddressId(a.id);
    setAddress({ ...a, country: a.country || country.code });
    setAddressErrors({});
  }

  function selectNewAddress() {
    setSelectedAddressId('new');
    setAddress({ line1: '', city: '', state: '', pincode: '', phone: '', country: country.code });
    setAddressErrors({});
  }

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

  const isWholesale = !!user?.isWholesale;
  const subtotal = lines.reduce((sum, l) => sum + getEffectivePrice(l.sizeInfo, isWholesale) * l.quantity, 0);
  // "To Pay" (courier collects on delivery, at their own rate) only makes
  // sense for domestic delivery — force back to the store's own "Shipping"
  // fee for international, where it isn't offered as a choice.
  const isDomesticAddress = !address.country || address.country === 'IN';
  const effectiveShippingChoice = isDomesticAddress ? shippingChoice : 'shipping';
  const shipping = getShippingFee(address.country, subtotal, loyaltyTier?.freeShippingMinOrder, effectiveShippingChoice);
  // "To Pay" always shows (there's a real choice to reflect back, even
  // though the store isn't charging for it); "Shipping" only shows when
  // there's an actual charge — omit it entirely rather than show "Free".
  const showShippingRow = effectiveShippingChoice === 'to_pay' ? true : shipping > 0;
  const shippingLabel = effectiveShippingChoice === 'to_pay' ? 'To Pay' : 'Shipping';
  // What "Shipping" would cost regardless of which option is currently
  // selected — shown on that option itself so switching to "To Pay" doesn't
  // hide what the alternative is.
  const shippingOptionFee = getShippingFee(address.country, subtotal, loyaltyTier?.freeShippingMinOrder, 'shipping');
  const couponStale = appliedCoupon && appliedCoupon.subtotalAtApply !== subtotal;
  const discount = appliedCoupon && !couponStale ? appliedCoupon.discount : 0;
  const pointsToRedeem = usePoints ? Math.min(pointsBalance, Math.max(0, subtotal + shipping - discount)) : 0;
  // Always recomputed against the card's own fixed balance and whatever's
  // left after coupon/points — unlike a coupon, a gift card never goes
  // "stale" as the cart changes, it just covers more or less of it.
  const giftCardApplied = appliedGiftCard
    ? Math.min(appliedGiftCard.balance, Math.max(0, subtotal + shipping - discount - pointsToRedeem))
    : 0;
  const total = subtotal + shipping - discount - pointsToRedeem - giftCardApplied;
  const minOrderCheck = checkMinOrder(subtotal);
  const hasOutOfStock = lines.some((l) => l.sizeInfo.stock <= 0);
  // Guests placing a Cash-on-Delivery order must verify the delivery phone
  // first (see backend/routes/orders.js) — logged-in customers already
  // proved phone ownership at signup, and prepaid orders are already
  // trust-gated by a captured payment.
  const codNeedsVerification = !isLoggedIn && paymentMethod === 'cod' && codVerifiedPhone !== address.phone;

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

  async function handleApplyGiftCard() {
    const code = giftCardInput.trim();
    if (!code) return;
    setApplyingGiftCard(true);
    setGiftCardError('');
    try {
      const res = await api.validateGiftCard(token, code);
      setAppliedGiftCard({ code: res.code, balance: res.balance });
      showToast(`Gift card applied — ₹${res.balance} available.`);
    } catch (err) {
      setAppliedGiftCard(null);
      setGiftCardError(err.message);
    } finally {
      setApplyingGiftCard(false);
    }
  }

  function removeGiftCard() {
    setAppliedGiftCard(null);
    setGiftCardInput('');
    setGiftCardError('');
  }

  async function handleApplyAffiliate() {
    const code = affiliateInput.trim();
    if (!code) return;
    setApplyingAffiliate(true);
    setAffiliateError('');
    try {
      const res = await api.validateAffiliateCode(token, code);
      setAppliedAffiliateCode(res.code);
    } catch (err) {
      setAppliedAffiliateCode(null);
      setAffiliateError(err.message);
    } finally {
      setApplyingAffiliate(false);
    }
  }

  function removeAffiliateCode() {
    setAppliedAffiliateCode(null);
    setAffiliateInput('');
    setAffiliateError('');
  }

  // A guest's phone number matched an existing account (backend/routes/
  // orders.js) — send them straight to login instead of leaving them to find
  // it themselves; `from: '/cart'` brings them right back to checkout after.
  function handleOrderError(err) {
    showToast(err.message, 'error');
    if (err.message.includes('account already exists')) {
      navigate('/login', { state: { from: '/cart' } });
    }
  }

  async function handlePlaceOrder(e) {
    e.preventDefault();
    if (hasOutOfStock) {
      showToast('One or more items in your cart are currently out of stock. Please remove them to continue.', 'error');
      return;
    }
    if (!minOrderCheck.met) {
      showToast(`Minimum order for ${country.label} is ${minOrderCheck.minFormatted}.`, 'error');
      return;
    }
    if (codNeedsVerification) {
      showToast('Please verify your phone number to place a Cash on Delivery order.', 'error');
      return;
    }
    const errors = validateAddress(address);
    setAddressErrors(errors);
    const gErrors = isLoggedIn ? {} : validateGuestInfo(guestName, guestEmail);
    setGuestErrors(gErrors);
    if (Object.keys(errors).length || Object.keys(gErrors).length) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }
    setPlacing(true);
    const orderItems = lines.map((l) => ({ productId: l.productId, size: l.size, quantity: l.quantity }));
    const couponCode = !couponStale && appliedCoupon ? appliedCoupon.code : undefined;
    const giftCardCode = appliedGiftCard ? appliedGiftCard.code : undefined;
    const guestInfo = isLoggedIn ? undefined : { name: guestName.trim(), email: guestEmail.trim() };
    const giftFields = { isGift, giftMessage: isGift ? giftMessage.trim() : undefined };
    const affiliateCode = appliedAffiliateCode || undefined;
    try {
      if (paymentMethod === 'razorpay') {
        await payWithRazorpay(orderItems, couponCode, guestInfo, giftCardCode, giftFields, affiliateCode);
      } else if (paymentMethod === 'cod_advance') {
        await payCodAdvance(orderItems, couponCode, guestInfo, giftCardCode, giftFields, affiliateCode);
      } else {
        const data = await api.placeOrder(token, { items: orderItems, address, paymentMethod: 'cod', couponCode, pointsToRedeem, guestInfo, shippingChoice: effectiveShippingChoice, giftCardCode, ...giftFields, affiliateCode });
        finishOrder(data, address);
      }
    } catch (err) {
      handleOrderError(err);
    } finally {
      setPlacing(false);
    }
  }

  // Shared by the COD and Razorpay success paths — a guest checkout returns
  // a fresh token/user (see backend/routes/orders.js), which logs them in
  // seamlessly so they land on Order Success/My Orders like any other
  // customer instead of a dead end with no way to see their own order.
  function finishOrder(data, deliveredTo) {
    const effectiveToken = data.token || token;
    if (data.token) {
      login(data.token, data.user);
      showToast(`Account created — track this order anytime from "My Orders."`);
    }
    if (!isBuyNow) clearCart();

    // Only append a new address book entry when checkout actually used a
    // freshly-typed one — an existing saved address was picked as-is, so
    // overwriting the whole array here would silently wipe out every other
    // saved address (the bug this replaced).
    const isNewAddress = !isLoggedIn || selectedAddressId === 'new';
    if (isNewAddress) {
      const existing = normalizeAddresses((data.user || user)?.addresses);
      const entry = { ...deliveredTo, id: crypto.randomUUID(), isDefault: existing.length === 0 };
      api.updateProfile(effectiveToken, { addresses: [...existing, entry] }).catch(() => {});
    }
    navigate(`/order-success/${data.order.id}`);
  }

  async function payWithRazorpay(orderItems, couponCode, guestInfo, giftCardCode, giftFields = {}, affiliateCode) {
    const rzpOrder = await api.createRazorpayOrder(token, { items: orderItems, couponCode, pointsToRedeem, address, guestInfo, shippingChoice: effectiveShippingChoice, giftCardCode });
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
            const data = await api.verifyRazorpayPayment(token, { items: orderItems, address, couponCode, pointsToRedeem, guestInfo, shippingChoice: effectiveShippingChoice, giftCardCode, ...giftFields, affiliateCode, ...response });
            finishOrder(data, address);
            resolve();
          } catch (err) {
            handleOrderError(err);
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

  // Same flow as payWithRazorpay, but only the small COD_ADVANCE_INR advance
  // is charged — the order itself still records the rest as due on delivery.
  async function payCodAdvance(orderItems, couponCode, guestInfo, giftCardCode, giftFields = {}, affiliateCode) {
    const rzpOrder = await api.createCodAdvanceOrder(token, { items: orderItems, couponCode, pointsToRedeem, address, guestInfo, shippingChoice: effectiveShippingChoice, giftCardCode });
    await loadRazorpay();

    return new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: rzpOrder.keyId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        order_id: rzpOrder.razorpayOrderId,
        name: 'Western Gods Organics',
        description: `₹${rzpOrder.advanceAmount} advance · Order · ${orderItems.length} item(s)`,
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
            const data = await api.verifyCodAdvancePayment(token, { items: orderItems, address, couponCode, pointsToRedeem, guestInfo, shippingChoice: effectiveShippingChoice, giftCardCode, ...giftFields, affiliateCode, ...response });
            finishOrder(data, address);
            resolve();
          } catch (err) {
            handleOrderError(err);
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
          {lines.map((l) => {
            const lineOutOfStock = l.sizeInfo.stock <= 0;
            return (
              <div className="cart-line" key={`${l.productId}-${l.size}`}>
                <img src={getProductImage(l.product.image)} alt={l.product.name} />
                <div className="cart-line-details">
                  <h3 style={{ marginBottom: 4 }}>{l.product.name}</h3>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>Size: {l.size}</span>
                  {lineOutOfStock && (
                    <div className="field-error" style={{ marginTop: 4 }}>Currently stock not available</div>
                  )}
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
                    <button onClick={() => setBuyNowQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" disabled={lineOutOfStock}>−</button>
                    <span>{l.quantity}</span>
                    <button onClick={() => setBuyNowQty((q) => q + 1)} aria-label="Increase quantity" disabled={lineOutOfStock}>+</button>
                  </div>
                ) : (
                  <div className="qty-stepper">
                    <button onClick={() => updateQuantity(l.productId, l.size, l.quantity - 1)} aria-label="Decrease quantity" disabled={lineOutOfStock}>−</button>
                    <span>{l.quantity}</span>
                    <button onClick={() => updateQuantity(l.productId, l.size, l.quantity + 1)} aria-label="Increase quantity" disabled={lineOutOfStock}>+</button>
                  </div>
                )}
                <div className="price" style={{ fontFamily: 'var(--font-mono)' }}>
                  ₹{getEffectivePrice(l.sizeInfo, isWholesale) * l.quantity}
                </div>
              </div>
            );
          })}
          {isBuyNow && (
            <Link to="/cart" className="link-btn" style={{ marginTop: 12, display: 'inline-block' }}>
              ← Go to your full cart instead
            </Link>
          )}
        </div>

        <div className="summary-card">
          <h3>Order Summary</h3>
          <div className="summary-row"><span>Subtotal</span><span>₹{subtotal}</span></div>
          {showShippingRow && (
            <div className="summary-row">
              <span>{shippingLabel}</span><span>{effectiveShippingChoice === 'to_pay' ? 'At delivery' : `₹${shipping}`}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="summary-row" style={{ color: '#1e6b34' }}>
              <span>Coupon ({appliedCoupon.code})</span><span>−₹{discount}</span>
            </div>
          )}
          {pointsToRedeem > 0 && (
            <div className="summary-row" style={{ color: '#1e6b34' }}>
              <span>Reward points</span><span>−₹{pointsToRedeem}</span>
            </div>
          )}
          {giftCardApplied > 0 && (
            <div className="summary-row" style={{ color: '#1e6b34' }}>
              <span>Gift card ({appliedGiftCard.code})</span><span>−₹{giftCardApplied}</span>
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

          <div className="coupon-field">
            {appliedGiftCard ? (
              <div className="coupon-applied">
                <span>
                  🎁 <b>{appliedGiftCard.code}</b> applied — ₹{appliedGiftCard.balance} available
                </span>
                <button type="button" className="link-btn" onClick={removeGiftCard}>Remove</button>
              </div>
            ) : (
              <>
                <div className="flex gap-1">
                  <input
                    placeholder="Gift card code"
                    value={giftCardInput}
                    onChange={(e) => setGiftCardInput(e.target.value.toUpperCase())}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={!giftCardInput.trim() || applyingGiftCard}
                    onClick={handleApplyGiftCard}
                  >
                    {applyingGiftCard ? 'Applying…' : 'Apply'}
                  </button>
                </div>
                {giftCardError && <div className="field-error">{giftCardError}</div>}
              </>
            )}
          </div>

          {isLoggedIn && pointsBalance > 0 && (
            <div className="coupon-field">
              <label className="flex gap-2" style={{ alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
                <span>
                  Use your {pointsBalance} reward points
                  {usePoints ? ` (₹${pointsToRedeem} off)` : ` (worth ₹${pointsBalance})`}
                </span>
              </label>
            </div>
          )}

          {!showAddressForm ? (
            <div className="cart-cta-bar">
              <div className="cart-cta-total">
                <span className="muted">Total</span>
                <b>₹{total}</b>
              </div>
              <button
                className="btn btn-gold btn-block"
                style={{ marginTop: 18 }}
                onClick={() => setShowAddressForm(true)}
              >
                Proceed to checkout
              </button>
              {!isLoggedIn && (
                <p className="muted center" style={{ marginTop: 10, fontSize: '0.85rem' }}>
                  Have an account?{' '}
                  <Link to="/login" state={{ from: '/cart', buyNow: buyNowItem || undefined }}>Log in</Link> for faster checkout.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handlePlaceOrder} style={{ marginTop: 18 }} noValidate>
              {!isLoggedIn && (
                <>
                  <div className="checkout-step">
                    <span className="checkout-step-num">1</span>
                    <h4>Your Details</h4>
                  </div>
                  <div className="field">
                    <label>Full name *</label>
                    <input required value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                    {guestErrors.name && <div className="field-error">{guestErrors.name}</div>}
                  </div>
                  <div className="field">
                    <label>Email (optional, for order updates)</label>
                    <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
                    {guestErrors.email && <div className="field-error">{guestErrors.email}</div>}
                  </div>
                </>
              )}
              <div className="checkout-step">
                <span className="checkout-step-num">{isLoggedIn ? 1 : 2}</span>
                <h4>Delivery Address</h4>
              </div>
              {isLoggedIn && user?.addresses?.length > 0 && (
                <div className="address-picker" style={{ marginBottom: 14 }}>
                  {normalizeAddresses(user.addresses).map((a) => (
                    <label key={a.id} className={`payment-option ${selectedAddressId === a.id ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="savedAddress"
                        checked={selectedAddressId === a.id}
                        onChange={() => selectSavedAddress(a)}
                      />
                      <span className="filter-radio" aria-hidden="true" />
                      <span className="payment-option-body">
                        <b>{a.label || 'Address'}{a.isDefault ? ' · Default' : ''}</b>
                        <span className="muted">{a.line1}, {a.city}, {a.state} – {a.pincode}, {a.phone}</span>
                      </span>
                    </label>
                  ))}
                  <label className={`payment-option ${selectedAddressId === 'new' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="savedAddress"
                      checked={selectedAddressId === 'new'}
                      onChange={selectNewAddress}
                    />
                    <span className="filter-radio" aria-hidden="true" />
                    <span className="payment-option-body">
                      <b>+ Use a new address</b>
                    </span>
                  </label>
                </div>
              )}
              {(!isLoggedIn || !user?.addresses?.length || selectedAddressId === 'new') && (
                <AddressForm address={address} onChange={updateAddress} errors={addressErrors} showCustomsNote />
              )}

              <div className="field" style={{ marginTop: 14 }}>
                <label className="flex gap-2" style={{ alignItems: 'center', cursor: 'pointer', fontWeight: 400 }}>
                  <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
                  🎁 This is a gift — add a note for the recipient
                </label>
                {isGift && (
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder="e.g. Happy birthday! Enjoy some cold-pressed goodness."
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>

              <div className="field">
                <label>Affiliate code (optional)</label>
                {appliedAffiliateCode ? (
                  <div className="coupon-applied">
                    <span>✓ Code <b>{appliedAffiliateCode}</b> applied</span>
                    <button type="button" className="link-btn" onClick={removeAffiliateCode}>Remove</button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-1">
                      <input
                        placeholder="e.g. SARAH10"
                        value={affiliateInput}
                        onChange={(e) => setAffiliateInput(e.target.value.toUpperCase())}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={!affiliateInput.trim() || applyingAffiliate}
                        onClick={handleApplyAffiliate}
                      >
                        {applyingAffiliate ? 'Applying…' : 'Apply'}
                      </button>
                    </div>
                    {affiliateError && <div className="field-error">{affiliateError}</div>}
                  </>
                )}
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
                  Credits whoever referred you to our affiliate program — doesn't change your total.
                </p>
              </div>

              {isDomesticAddress && (
                <>
                  <div className="checkout-step" style={{ marginTop: 22 }}>
                    <span className="checkout-step-num">{isLoggedIn ? 2 : 3}</span>
                    <h4>Delivery Method</h4>
                  </div>
                  <div className="payment-options">
                    <label className={`payment-option ${shippingChoice === 'shipping' ? 'active' : ''}`}>
                      <input type="radio" name="shippingChoice" checked={shippingChoice === 'shipping'} onChange={() => setShippingChoice('shipping')} />
                      <span className="filter-radio" aria-hidden="true" />
                      <span className="payment-option-body">
                        <b>Shipping</b>
                        <span className="muted">{shippingOptionFee === 0 ? 'Free' : `₹${shippingOptionFee}`} — included in your order total</span>
                      </span>
                    </label>
                    <label className={`payment-option ${shippingChoice === 'to_pay' ? 'active' : ''}`}>
                      <input type="radio" name="shippingChoice" checked={shippingChoice === 'to_pay'} onChange={() => setShippingChoice('to_pay')} />
                      <span className="filter-radio" aria-hidden="true" />
                      <span className="payment-option-body">
                        <b>To Pay</b>
                        <span className="muted">Courier collects their own delivery charge directly from you — not included here</span>
                      </span>
                    </label>
                  </div>
                </>
              )}

              <div className="checkout-step" style={{ marginTop: 22 }}>
                <span className="checkout-step-num">{(isLoggedIn ? 2 : 3) + (isDomesticAddress ? 1 : 0)}</span>
                <h4>Payment Method</h4>
              </div>
              <div className="payment-options">
                {enabledMethods.cod && (
                  <label className={`payment-option ${paymentMethod === 'cod' ? 'active' : ''}`}>
                    <input type="radio" name="paymentMethod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                    <span className="filter-radio" aria-hidden="true" />
                    <span className="payment-option-body">
                      <b>Cash on Delivery</b>
                      <span className="muted">Pay in cash when your order arrives</span>
                    </span>
                  </label>
                )}
                {enabledMethods.razorpay && (
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
                )}
                {razorpayEnabled && enabledMethods.razorpay && enabledMethods.codAdvance && codAdvanceInr > 0 && (
                  <label className={`payment-option ${paymentMethod === 'cod_advance' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'cod_advance'}
                      onChange={() => setPaymentMethod('cod_advance')}
                    />
                    <span className="filter-radio" aria-hidden="true" />
                    <span className="payment-option-body">
                      <b>Pay ₹{codAdvanceInr} now, rest on delivery</b>
                      <span className="muted">A small advance confirms your order — pay the balance in cash when it arrives</span>
                    </span>
                  </label>
                )}
              </div>

              {!isLoggedIn && paymentMethod === 'cod' && (
                <CodPhoneVerify
                  phone={address.phone}
                  country={address.country}
                  verified={codVerifiedPhone === address.phone}
                  onVerified={setCodVerifiedPhone}
                />
              )}

              {hasOutOfStock && (
                <div className="alert alert-error" style={{ marginTop: 16 }}>
                  One or more items in your cart are currently out of stock. Please remove them to continue.
                </div>
              )}
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
                <button
                  className="btn btn-gold btn-block"
                  style={{ marginTop: 18 }}
                  disabled={placing || !minOrderCheck.met || hasOutOfStock || codNeedsVerification}
                >
                  {placing
                    ? 'Processing…'
                    : paymentMethod === 'razorpay'
                    ? 'Pay securely'
                    : paymentMethod === 'cod_advance'
                    ? `Pay ₹${codAdvanceInr} & place order`
                    : 'Place order'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
