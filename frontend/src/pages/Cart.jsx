import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { getProductImage } from '../utils/productImages';
import { trackBeginCheckout, trackPurchase } from '../utils/analytics';
import { loadRazorpay } from '../utils/loadRazorpay';
import { validateAddress, isValidEmail } from '../utils/validators';
import { normalizeAddresses } from '../utils/addresses';
import { getEffectivePrice } from '../utils/pricing';
import { getAttributedAffiliateCode } from '../utils/affiliateAttribution';
import { STORE_LOCATIONS, directionsUrl } from '../data/storeLocations';
import ChakkiWheel from '../components/ChakkiWheel';
import { useFestivalContext } from '../components/festival/FestivalContext';
import AddressForm, { PhoneField } from '../components/AddressForm';
import CodPhoneVerify from '../components/CodPhoneVerify';
import CheckoutLoginPrompt from '../components/CheckoutLoginPrompt';

// One heading per basis the also-bought route can return, so the cart never
// claims data it doesn't have. "Often bought" is a statement about other
// customers and is only allowed when there are orders behind it; "same
// parcel" claims nothing but the fact that the box is already going.
const SUGGESTION_HEADINGS = {
  'bought-together': 'Often bought with this',
  kit: 'The rest of the set',
  parcel: 'Goes in the same parcel — nothing extra to deliver',
};

function validateContactInfo(name, email) {
  const errors = {};
  if (!name || name.trim().length < 2) errors.name = 'Enter your name.';
  if (email && !isValidEmail(email)) errors.email = 'Enter a valid email address, or leave it blank.';
  return errors;
}

export default function Cart() {
  const { festival: nearFestival, theme: festivalTheme } = useFestivalContext();
  const { items, addItem, updateQuantity, removeItem, clearCart } = useCart();
  const { isLoggedIn, token, user, login, updateUser } = useAuth();
  const { showToast } = useToast();
  const { isForeign, checkMinOrder, getShippingFee, getFreeShippingGap, country, pickup } = useCurrency();
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
  // The one place we ask a signed-out shopper whether they'd rather log in —
  // at "Proceed to checkout", while it can still save them typing, and never
  // again once they've answered.
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [address, setAddress] = useState({ line1: '', city: '', state: '', pincode: '', phone: '', country: country.code });
  const [addressErrors, setAddressErrors] = useState({});
  const [selectedAddressId, setSelectedAddressId] = useState('new');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactErrors, setContactErrors] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' | 'razorpay' | 'cod_advance'
  const [shippingChoice, setShippingChoice] = useState('shipping'); // 'shipping' | 'to_pay'
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [codVerifiedPhone, setCodVerifiedPhone] = useState(null);
  // Set when the server reports this phone already belongs to an account —
  // surfaces the inline OTP widget for non-COD methods too.
  const [phoneNeedsVerification, setPhoneNeedsVerification] = useState(false);
  const [buyNowQty, setBuyNowQty] = useState(buyNowItem?.quantity || 1);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discount, subtotalAtApply }
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [prepaidDiscountPercent, setPrepaidDiscountPercent] = useState(0);
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
    api.getProducts({}, token).then((d) => setProducts(d.products));
    api.getConfig().then((d) => {
      setRazorpayEnabled(!!d.razorpayEnabled);
      setCodAdvanceInr(d.codAdvanceInr || 0);
      if (d.paymentMethods) {
        setEnabledMethods(d.paymentMethods);
        setPrepaidDiscountPercent(Number(d.paymentMethods.prepaidDiscountPercent) || 0);
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

  // Checkout asks everyone for name, email and phone up front, so a signed-in
  // customer sees their own details already filled in rather than a blank
  // form. Whatever they leave in these fields is what the order — and their
  // account record — ends up carrying.
  useEffect(() => {
    if (!user) return;
    setContactName((prev) => prev || user.name || '');
    setContactEmail((prev) => prev || user.email || '');
    setAddress((prev) => (prev.phone ? prev : { ...prev, phone: user.phone || '' }));
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
      return [{
        productId: buyNowItem.productId,
        size: buyNowItem.size,
        quantity: buyNowQty,
        // Present only when this is a reservation against an upcoming pressing
        // (see ProductDetail's handleReserve) — carried through to the order.
        pressingId: buyNowItem.pressingId,
        product,
        sizeInfo,
      }];
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

  // What else could go in this parcel. The server decides both what to offer
  // and on what grounds — real co-purchase, a kit, or simply that the box is
  // already going — and hands back the grounds so the heading below can say
  // something true rather than "recommended for you". Keyed on the set of
  // product ids, not the whole cart, so changing a quantity doesn't refetch.
  const cartProductIds = useMemo(
    () => [...new Set(lines.map((l) => l.productId))].sort().join(','),
    [lines]
  );
  const [suggestions, setSuggestions] = useState({ basis: 'none', products: [] });
  useEffect(() => {
    if (!cartProductIds) {
      setSuggestions({ basis: 'none', products: [] });
      return undefined;
    }
    let cancelled = false;
    api
      .getAlsoBought(cartProductIds.split(','), token)
      // Silent on failure: this is an aside, and a cart that shows an error
      // where a suggestion should be is worse than one that shows nothing.
      .then((d) => { if (!cancelled) setSuggestions({ basis: d.basis, products: d.products }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cartProductIds, token]);

  // A reservation is for oil that hasn't been pressed yet, so there's nothing
  // for a courier to collect against. The server refuses anything but online
  // payment (see utils/orderBuilder.js); this switches the form to match so
  // the customer meets the rule as a fact about the page rather than as a
  // rejection after they've filled everything in.
  const isReservation = lines.some((l) => l.pressingId);
  useEffect(() => {
    if (isReservation) setPaymentMethod('razorpay');
  }, [isReservation]);

  // Must stay below the `subtotal` declaration above — a hook that reads a
  // `const` defined later in the component hits the temporal dead zone on
  // every render, which throws before the app can mount.
  // Re-fetched as the subtotal moves so each chip's savings and its
  // eligible/"spend more" state stay truthful while items are added or
  // removed. Silent on failure — the manual code field still works.
  useEffect(() => {
    if (subtotal <= 0) {
      setAvailableCoupons([]);
      return undefined;
    }
    let cancelled = false;
    api
      .getAvailableCoupons(token, subtotal)
      .then((d) => { if (!cancelled) setAvailableCoupons(d.coupons || []); })
      .catch(() => { if (!cancelled) setAvailableCoupons([]); });
    return () => { cancelled = true; };
  }, [subtotal, token]);

  // "To Pay" (courier collects on delivery, at their own rate) only makes
  // sense for domestic delivery — force back to the store's own "Shipping"
  // fee for international, where it isn't offered as a choice.
  const isDomesticAddress = !address.country || address.country === 'IN';
  const effectiveShippingChoice = isDomesticAddress ? shippingChoice : 'shipping';
  const shipping = getShippingFee(address.country, subtotal, loyaltyTier?.freeShippingMinOrder, effectiveShippingChoice, address.pincode);
  // "To Pay" and "Collection" always show — each is a real choice worth
  // reflecting back even though the store charges nothing for it. "Shipping"
  // only shows when there's an actual charge, rather than a row saying "Free".
  const showShippingRow = effectiveShippingChoice === 'shipping' ? shipping > 0 : true;
  const shippingLabel =
    effectiveShippingChoice === 'to_pay' ? 'To Pay'
      : effectiveShippingChoice === 'pickup' ? 'Collection' : 'Shipping';
  // What "Shipping" would cost regardless of which option is currently
  // selected — shown on that option itself so switching to "To Pay" doesn't
  // hide what the alternative is.
  const shippingOptionFee = getShippingFee(address.country, subtotal, loyaltyTier?.freeShippingMinOrder, 'shipping', address.pincode);
  // How much further before delivery stops being charged. Same arguments as
  // the fee above, so it moves with the pincode, the loyalty tier and the
  // delivery choice rather than quoting one fixed number at everybody. Null
  // whenever there's nothing to chase, which is what hides the bar.
  const freeShipping = getFreeShippingGap(address.country, subtotal, loyaltyTier?.freeShippingMinOrder, effectiveShippingChoice, address.pincode);
  const couponStale = appliedCoupon && appliedCoupon.subtotalAtApply !== subtotal;
  const discount = appliedCoupon && !couponStale ? appliedCoupon.discount : 0;
  // Preview only — buildOrderItems recomputes this server-side from the
  // admin's stored rate and is the authority. Kept formula-identical to it
  // (post-coupon basis, rounded, clamped) so the total shown here matches
  // what actually gets charged. Only full prepayment earns it; 'cod_advance'
  // still leaves most of the total to collect on delivery.
  const prepaidDiscount =
    paymentMethod === 'razorpay' && prepaidDiscountPercent > 0
      ? Math.min(
          Math.round(((subtotal - discount) * prepaidDiscountPercent) / 100),
          Math.max(0, subtotal - discount)
        )
      : 0;
  const pointsToRedeem = usePoints ? Math.min(pointsBalance, Math.max(0, subtotal + shipping - discount - prepaidDiscount)) : 0;
  // Always recomputed against the card's own fixed balance and whatever's
  // left after coupon/points — unlike a coupon, a gift card never goes
  // "stale" as the cart changes, it just covers more or less of it.
  const giftCardApplied = appliedGiftCard
    ? Math.min(appliedGiftCard.balance, Math.max(0, subtotal + shipping - discount - prepaidDiscount - pointsToRedeem))
    : 0;
  const total = subtotal + shipping - discount - prepaidDiscount - pointsToRedeem - giftCardApplied;
  // What switching to full prepayment would save, for the nudge on the COD
  // option — computed even when COD is selected, hence not reusing the above.
  const prepaidSavings =
    prepaidDiscountPercent > 0
      ? Math.min(Math.round(((subtotal - discount) * prepaidDiscountPercent) / 100), Math.max(0, subtotal - discount))
      : 0;
  const minOrderCheck = checkMinOrder(subtotal);
  const hasOutOfStock = lines.some((l) => l.sizeInfo.stock <= 0);
  // Guests placing a Cash-on-Delivery order must verify the delivery phone
  // first (see backend/routes/orders.js) — logged-in customers already
  // proved phone ownership at signup, and prepaid orders are already
  // trust-gated by a captured payment.
  // Blocks the submit button while an OTP is still outstanding — for a guest
  // COD order, or once the server has told us this phone belongs to an
  // existing account (any payment method).
  const codNeedsVerification =
    !isLoggedIn && (paymentMethod === 'cod' || phoneNeedsVerification) && codVerifiedPhone !== address.phone;

  function updateAddress(field, value) {
    setAddress((a) => ({ ...a, [field]: value }));
    setAddressErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
  }

  async function handleApplyCoupon(codeOverride) {
    const code = (typeof codeOverride === 'string' ? codeOverride : couponInput).trim();
    if (!code) return;
    setApplyingCoupon(true);
    setCouponError('');
    try {
      // Still goes through the same validate route as a typed code — a chip
      // is a convenience, not a bypass, and the order routes re-check again.
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

  // The server asks for phone verification in two cases: a guest paying by
  // COD, and a checkout whose phone already belongs to an account. Either
  // way the customer stays on this page and verifies inline — they used to
  // be redirected to /login for the second case, which lost the checkout.
  function handleOrderError(err) {
    showToast(err.message, 'error');
    if (err.requiresPhoneVerification) setPhoneNeedsVerification(true);
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
    const gErrors = validateContactInfo(contactName, contactEmail);
    setContactErrors(gErrors);
    if (Object.keys(errors).length || Object.keys(gErrors).length) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }
    setPlacing(true);
    // Paired with the purchase event below, this is what shows how many people
    // start paying and don't finish — the number worth acting on.
    trackBeginCheckout(lines, total);
    const orderItems = lines.map((l) => ({
      productId: l.productId,
      size: l.size,
      quantity: l.quantity,
      ...(l.pressingId ? { pressingId: l.pressingId } : {}),
    }));
    const couponCode = !couponStale && appliedCoupon ? appliedCoupon.code : undefined;
    const giftCardCode = appliedGiftCard ? appliedGiftCard.code : undefined;
    // Sent whether or not they're signed in: for a guest it's the identity the
    // new account is built from, and for a signed-in customer it's how edits
    // made here flow back onto their saved profile.
    const guestInfo = { name: contactName.trim(), email: contactEmail.trim() };
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
    } else if (isLoggedIn) {
      // The server just wrote these back onto the account (see
      // syncContactDetails in backend/routes/orders.js) — mirror it locally so
      // the header and profile don't keep showing the old name until reload.
      updateUser({ name: contactName.trim() || user?.name, email: contactEmail.trim() || user?.email });
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
    // Every payment path (COD, COD-advance, Razorpay) converges here, so this
    // is the one place a completed order can be counted exactly once.
    trackPurchase(data.order);
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

          {/* Anything else for the box. Hidden during Buy Now, which is
              deliberately a single item and does not touch the saved cart —
              an Add button there would quietly put things somewhere the
              shopper isn't looking. */}
          {!isBuyNow && suggestions.products.length > 0 && (
            <div className="cart-suggestions">
              <h4>{SUGGESTION_HEADINGS[suggestions.basis] || SUGGESTION_HEADINGS.parcel}</h4>
              <div className="cart-suggestion-list">
                {suggestions.products.map((p) => {
                  const size = (p.sizes || []).find((s) => Number(s.stock) > 0);
                  if (!size) return null;
                  return (
                    <div className="cart-suggestion" key={p.id}>
                      <Link to={`/product/${p.id}`}>
                        <img src={getProductImage(p.image)} alt="" />
                      </Link>
                      <div className="cart-suggestion-body">
                        <Link to={`/product/${p.id}`}>{p.name}</Link>
                        <span className="muted">{size.label} · ₹{getEffectivePrice(size, isWholesale)}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          addItem(p.id, size.label, 1);
                          showToast(`${p.name} added.`);
                        }}
                      >
                        Add
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="summary-card">
          <h3>Order Summary</h3>
          {/* Somebody ₹120 short of free delivery is being charged ₹60 for
              want of information nobody gave them — and one more soap would
              have cost less than the delivery does. The number comes from the
              same function that sets the fee, so this can't promise a saving
              checkout won't honour. */}
          {freeShipping && (
            <div className="free-ship-nudge">
              <p>
                Add <b>₹{freeShipping.gap}</b> more and delivery is free
                <span className="muted"> — you're paying ₹{freeShipping.fee} for it now</span>
              </p>
              <div
                className="free-ship-meter"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={freeShipping.target}
                aria-valuenow={subtotal}
                aria-label={`₹${freeShipping.gap} more for free delivery`}
              >
                <div className="free-ship-meter-fill" style={{ width: `${Math.round(freeShipping.progress * 100)}%` }} />
              </div>
              {!isBuyNow && <Link to="/shop" className="link-btn">Add something small →</Link>}
            </div>
          )}
          {/* And say so once they're over it. Without this, crossing the line
              just makes the bar vanish and the Shipping row disappear, which
              reads as the page losing interest rather than as good news. */}
          {!freeShipping && isDomesticAddress && effectiveShippingChoice === 'shipping' && subtotal > 0 && shipping === 0 && (
            <div className="free-ship-nudge earned">
              <p><b>Delivery is free on this order.</b></p>
            </div>
          )}
          {/* The deadline, at the one moment it changes a decision.
              It lived on the home page and the calendar, which is to say
              nowhere near the person deciding whether to order today. Hidden
              once ordering has closed rather than shown in red: at that point
              it is not a nudge, it is bad news about an order they have not
              placed yet, and the shop would rather sell them the oil anyway. */}
          {nearFestival && festivalTheme && !nearFestival.orderingClosed && (
            <div
              className={`fest-deadline${nearFestival.daysToOrderBy <= 2 ? ' is-urgent' : ''}`}
              style={{ '--fest-ink': festivalTheme.palette.accentDeep, '--fest-glow': festivalTheme.palette.glow }}
            >
              <b>{nearFestival.name}</b> — order by{' '}
              <b>{new Date(nearFestival.orderBy).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</b>
              {nearFestival.daysToOrderBy === 0
                ? ' — that is today'
                : nearFestival.daysToOrderBy === 1
                  ? ' — that is tomorrow'
                  : ` — ${nearFestival.daysToOrderBy} days left`}
            </div>
          )}
          <div className="summary-row"><span>Subtotal</span><span>₹{subtotal}</span></div>
          {showShippingRow && (
            <div className="summary-row">
              <span>{shippingLabel}</span>
              <span>
                {effectiveShippingChoice === 'to_pay' ? 'At delivery'
                  : effectiveShippingChoice === 'pickup' ? 'You collect'
                    : `₹${shipping}`}
              </span>
            </div>
          )}
          {discount > 0 && (
            <div className="summary-row" style={{ color: '#1e6b34' }}>
              <span>Coupon ({appliedCoupon.code})</span><span>−₹{discount}</span>
            </div>
          )}
          {prepaidDiscount > 0 && (
            <div className="summary-row" style={{ color: '#1e6b34' }}>
              <span>Prepaid discount ({prepaidDiscountPercent}%)</span><span>−₹{prepaidDiscount}</span>
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
                {/* Offers are shown as one-tap chips rather than an empty box:
                    an empty coupon field sends shoppers off-site to hunt for a
                    code, and many never come back. The manual field is still
                    here, just folded away for the rare code not listed. */}
                {availableCoupons.length > 0 && (
                  <div className="coupon-chips">
                    {availableCoupons.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        className={`coupon-chip ${c.personal ? 'coupon-chip-personal' : ''}`}
                        disabled={!c.eligible || applyingCoupon}
                        onClick={() => handleApplyCoupon(c.code)}
                        title={c.eligible ? `Apply ${c.code}` : `Spend ₹${c.minOrder - subtotal} more to use ${c.code}`}
                      >
                        <b>{c.code}</b>
                        <span>
                          {c.personal && '⭐ '}
                          {c.eligible
                            ? `Save ₹${c.discount}`
                            : `₹${c.minOrder - subtotal} more to unlock`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {!showCouponInput ? (
                  <button type="button" className="link-btn" onClick={() => setShowCouponInput(true)}>
                    Have another code?
                  </button>
                ) : (
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
                      onClick={() => handleApplyCoupon()}
                    >
                      {applyingCoupon ? 'Applying…' : 'Apply'}
                    </button>
                  </div>
                )}
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
                onClick={() => (isLoggedIn ? setShowAddressForm(true) : setShowLoginPrompt(true))}
              >
                Proceed to checkout
              </button>
            </div>
          ) : (
            <form onSubmit={handlePlaceOrder} style={{ marginTop: 18 }} noValidate>
              <div className="checkout-step">
                <span className="checkout-step-num">1</span>
                <h4>Your Details</h4>
              </div>
              <div className="field">
                <label>Full name *</label>
                <input required value={contactName} onChange={(e) => setContactName(e.target.value)} />
                {contactErrors.name && <div className="field-error">{contactErrors.name}</div>}
              </div>
              <div className="field">
                <label>Email (optional, for order updates)</label>
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                {contactErrors.email && <div className="field-error">{contactErrors.email}</div>}
              </div>
              {/* Bound to `address.phone` like it always was — the field just
                  sits with the other contact details now instead of at the
                  bottom of the address block. */}
              <PhoneField address={address} onChange={updateAddress} errors={addressErrors} />

              <div className="checkout-step">
                <span className="checkout-step-num">2</span>
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
                <AddressForm address={address} onChange={updateAddress} errors={addressErrors} showCustomsNote showPhone={false} />
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
                    <span className="checkout-step-num">3</span>
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
                    {pickup.enabled && (
                      <label className={`payment-option ${shippingChoice === 'pickup' ? 'active' : ''}`}>
                        <input type="radio" name="shippingChoice" checked={shippingChoice === 'pickup'} onChange={() => setShippingChoice('pickup')} />
                        <span className="filter-radio" aria-hidden="true" />
                        <span className="payment-option-body">
                          <b>Collect from the mill</b>
                          <span className="muted">
                            Free — {STORE_LOCATIONS[0].locality}
                            {pickup.hours && `, ${pickup.hours}`}
                          </span>
                        </span>
                      </label>
                    )}
                  </div>
                  {shippingChoice === 'pickup' && (
                    <div className="pickup-note">
                      <p>
                        <b>{STORE_LOCATIONS[0].name}</b><br />
                        {STORE_LOCATIONS[0].address}
                        {pickup.hours && <><br />{pickup.hours}</>}
                      </p>
                      {pickup.refillDiscount > 0 && (
                        // Stated as a promise kept at the counter, not taken off
                        // the total here: the mill can see whether a bottle
                        // actually turned up, and a discount given for one that
                        // didn't is money to chase back.
                        <p className="pickup-refill">
                          🫙 Bring your own clean bottles and we'll take{' '}
                          <b>₹{pickup.refillDiscount} off each one</b> when you collect.
                        </p>
                      )}
                      <a href={directionsUrl(STORE_LOCATIONS[0].address)} target="_blank" rel="noreferrer" className="link-btn">
                        Directions →
                      </a>
                      <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 0 }}>
                        We'll message you when it's ready. Your address below is still used for the bill.
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="checkout-step" style={{ marginTop: 22 }}>
                <span className="checkout-step-num">{isDomesticAddress ? 4 : 3}</span>
                <h4>Payment Method</h4>
              </div>
              <div className="payment-options">
                {isReservation && (
                  <p className="muted" style={{ margin: '0 0 10px', fontSize: '0.85rem' }}>
                    Reservations are paid online — the oil is pressed after you book it,
                    so there's nothing to collect on delivery.
                  </p>
                )}
                {enabledMethods.cod && !isReservation && (
                  <label className={`payment-option ${paymentMethod === 'cod' ? 'active' : ''}`}>
                    <input type="radio" name="paymentMethod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                    <span className="filter-radio" aria-hidden="true" />
                    <span className="payment-option-body">
                      <b>Cash on Delivery</b>
                      <span className="muted">Pay in cash when your order arrives</span>
                      {prepaidSavings > 0 && razorpayEnabled && enabledMethods.razorpay && (
                        <span className="payment-option-nudge">Pay online instead and save ₹{prepaidSavings}</span>
                      )}
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
                      {prepaidSavings > 0 && razorpayEnabled && (
                        <span className="payment-option-nudge">Save ₹{prepaidSavings} ({prepaidDiscountPercent}% off) by paying now</span>
                      )}
                    </span>
                  </label>
                )}
                {razorpayEnabled && enabledMethods.razorpay && enabledMethods.codAdvance && codAdvanceInr > 0 && !isReservation && (
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

              {/* Always shown for COD (a guest must prove the delivery number
                  before an unpaid order is accepted), and shown for any method
                  once the server says this phone belongs to an existing
                  account — that's a returning customer, and verifying here
                  keeps them in checkout instead of bouncing them to login. */}
              {!isLoggedIn && (paymentMethod === 'cod' || phoneNeedsVerification) && (
                <CodPhoneVerify
                  phone={address.phone}
                  country={address.country}
                  verified={codVerifiedPhone === address.phone}
                  onVerified={(p) => { setCodVerifiedPhone(p); setPhoneNeedsVerification(false); }}
                />
              )}
              {phoneNeedsVerification && codVerifiedPhone !== address.phone && (
                <div className="alert alert-info" style={{ marginTop: 12 }}>
                  You've ordered with this number before — verify it above and we'll add this order
                  to your existing account. No password needed.
                </div>
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

      {showLoginPrompt && (
        <CheckoutLoginPrompt
          onLogin={() => navigate('/login', { state: { from: '/cart', buyNow: buyNowItem || undefined } })}
          onGuest={() => { setShowLoginPrompt(false); setShowAddressForm(true); }}
        />
      )}
    </div>
  );
}
