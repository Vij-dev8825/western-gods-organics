import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';
import { IconHeart } from './Icons';
import { useLang } from '../i18n';
import { localizeProductText } from '../utils/productLocale';
import { getEffectivePrice, isWholesalePriceApplied } from '../utils/pricing';
import { flyToCart } from '../utils/flyToCart';
import { useReveal } from '../hooks/useReveal';
import FadeImage from './FadeImage';
import { canAnimateTransitions, claimHero, runViewTransition } from '../utils/viewTransition';

// Caps how long a big grid takes to finish cascading in — beyond this many
// cards, later ones just reveal at the same delay as the last staggered one
// instead of the user waiting seconds for row 6 to show up.
const MAX_STAGGER_INDEX = 7;
const STAGGER_STEP_MS = 60;

export default function ProductCard({ product, index }) {
  const { ref: revealRef, visible: revealed } = useReveal();
  const { productIds, toggleWishlist } = useWishlist();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const { formatPrice, formatProductPrice } = useCurrency();
  const { isLoggedIn, token, user } = useAuth();
  const isWholesale = !!user?.isWholesale;
  const { lang } = useLang();
  // Falls back to the English name until a Tamil (or Hindi, Telugu, Kannada)
  // one is entered, so nothing changes for a product nobody has renamed.
  const displayName = localizeProductText(product, 'name', lang) || product.name;
  const navigate = useNavigate();
  const [size, setSize] = useState(product.sizes[1]?.label || product.sizes[0].label);
  const [hoverIndex, setHoverIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyState, setNotifyState] = useState('idle'); // idle | submitting | done

  useEffect(() => {
    setNotifyOpen(false);
    setNotifyState('idle');
    setNotifyEmail('');
  }, [size]);

  const gallery = product.images?.length ? product.images : [product.image];
  const isWished = productIds.includes(product.id);
  const activeSize = product.sizes.find((s) => s.label === size) || product.sizes[0];
  const discount = Math.round(((activeSize.mrp - activeSize.price) / activeSize.mrp) * 100);
  const outOfStock = activeSize.stock <= 0;

  function scrubToClientX(clientX, rect) {
    const ratio = (clientX - rect.left) / rect.width;
    const idx = Math.min(gallery.length - 1, Math.max(0, Math.floor(ratio * gallery.length)));
    setHoverIndex(idx);
  }

  function handleMediaMouseMove(e) {
    if (gallery.length < 2) return;
    scrubToClientX(e.clientX, e.currentTarget.getBoundingClientRect());
  }

  function handleMediaTouchMove(e) {
    if (gallery.length < 2) return;
    scrubToClientX(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());
  }

  function handleAdd(e) {
    e.preventDefault();
    if (outOfStock) return;
    flyToCart(e.currentTarget.closest('.product-card')?.querySelector('.product-media img'));
    addItem(product.id, size, qty);
    showToast(`${displayName} (${size}) ×${qty} added to cart`);
  }

  function handleBuyNow(e) {
    e.preventDefault();
    if (outOfStock) return;
    navigate('/cart', { state: { buyNow: { productId: product.id, size, quantity: qty } } });
  }

  function stepQty(e, delta) {
    e.preventDefault();
    e.stopPropagation();
    setQty((q) => Math.max(1, q + delta));
  }

  function handleWishlist(e) {
    e.preventDefault();
    toggleWishlist(product.id);
    showToast(isWished ? `Removed from wishlist` : `${displayName} added to wishlist`);
  }

  async function handleNotifyMe(e) {
    e.preventDefault();
    if (!isLoggedIn && !notifyOpen) {
      setNotifyOpen(true);
      return;
    }
    if (!isLoggedIn && !notifyEmail.trim()) return;
    setNotifyState('submitting');
    try {
      const res = await api.subscribeStockNotify({ productId: product.id, size, email: notifyEmail.trim() }, token);
      showToast(res.message);
      setNotifyState('done');
    } catch (err) {
      showToast(err.message, 'error');
      setNotifyState('idle');
    }
  }

  /* Carries this card's photograph into the product page's hero image instead
     of cutting between two pages.
     Everything the browser needs is a synchronous DOM update inside the
     transition callback, which is why the navigate is wrapped in flushSync —
     React would otherwise batch it and the browser would snapshot the old
     page twice. */
  function handleCardClick(e) {
    // A quick-add or wishlist press inside the card has already cancelled the
    // navigation; anything with a modifier is someone opening a new tab, and
    // both should behave exactly as before.
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
    ) return;
    if (!canAnimateTransitions()) return; // plain <Link> navigation
    const img = e.currentTarget.querySelector('.product-media img');
    if (!img) return;

    e.preventDefault();
    claimHero(img);
    // The photograph travels with the navigation so the product page can paint
    // it immediately. Without it that page renders a spinner until its fetch
    // resolves, and the browser would snapshot the spinner — the morph would
    // land on nothing. It also just reads better: the picture you tapped is
    // already there while the rest of the page arrives.
    runViewTransition(() => {
      flushSync(() =>
        navigate(`/product/${product.id}`, {
          state: { heroImage: img.currentSrc || img.src, heroName: displayName },
        })
      );
    });
  }

  return (
    <Link
      to={`/product/${product.id}`}
      onClick={handleCardClick}
      ref={revealRef}
      className={`product-card card-reveal ${revealed ? 'card-reveal-visible' : ''}`}
      style={index != null ? { transitionDelay: `${Math.min(index, MAX_STAGGER_INDEX) * STAGGER_STEP_MS}ms` } : undefined}
    >
      <div
        className="product-media"
        onMouseMove={handleMediaMouseMove}
        onMouseLeave={() => setHoverIndex(0)}
        onTouchMove={handleMediaTouchMove}
      >
        {product.isNew && <span className="product-badge new-badge">New</span>}
        {discount > 0 && (
          <span className="product-badge" style={product.isNew ? { top: 44 } : undefined}>
            {discount}% OFF
          </span>
        )}
        {product.comboItems?.length > 0 && (
          <span
            className="product-badge combo-badge"
            style={{ top: 12 + (product.isNew ? 32 : 0) + (discount > 0 ? 32 : 0) }}
          >
            Combo
          </span>
        )}
        {outOfStock && (
          <span
            className="product-badge out-of-stock-badge"
            style={{ top: 12 + (product.isNew ? 32 : 0) + (discount > 0 ? 32 : 0) + (product.comboItems?.length > 0 ? 32 : 0) }}
          >
            Out of Stock
          </span>
        )}
        <button
          className={`wishlist-toggle ${isWished ? 'active' : ''}`}
          aria-label={isWished ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={handleWishlist}
        >
          <IconHeart filled={isWished} size={17} />
        </button>
        {gallery.length > 1 && (
          <div className="product-media-segments">
            {gallery.map((_, i) => (
              <span key={i} className={i === hoverIndex ? 'active' : ''} />
            ))}
          </div>
        )}
        <FadeImage src={getProductImage(gallery[hoverIndex])} alt={displayName} loading="lazy" />

        <div className="product-media-quickadd">
          <div className="qty-stepper qty-stepper-sm" onClick={(e) => e.preventDefault()}>
            <button onClick={(e) => stepQty(e, -1)} aria-label="Decrease quantity" disabled={outOfStock}>−</button>
            <span>{qty}</span>
            <button onClick={(e) => stepQty(e, 1)} aria-label="Increase quantity" disabled={outOfStock}>+</button>
          </div>
          <button className="btn btn-gold btn-sm" onClick={handleAdd} disabled={outOfStock}>
            {outOfStock ? 'Out of stock' : 'Add to cart'}
          </button>
        </div>
      </div>
      <div className="product-body">
        <h3>{displayName}</h3>
        {/* The whole card is already an <a>, so this can't be a nested Link —
            navigate programmatically instead of producing invalid markup. */}
        {product.sellerName && (
          <span
            className="muted"
            style={{ fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/sellers/${product.sellerId}`); }}
          >
            {product.sellerMode === 'marketplace' ? 'Sold by' : 'Made by'} {product.sellerName}
          </span>
        )}
        <p className="product-desc">{localizeProductText(product, 'shortDescription', lang)}</p>
        {/* Only shown once someone has actually left a review. A star with a
            zero beside it is worse than no star at all, and a number with no
            reviews behind it isn't ours to display. */}
        {product.reviewsCount > 0 && (
          <div className="rating-row">
            ★ {product.rating} <span className="count">({product.reviewsCount})</span>
          </div>
        )}

        <select
          className="select"
          value={size}
          onClick={(e) => e.preventDefault()}
          onChange={(e) => setSize(e.target.value)}
          aria-label="Select size"
        >
          {product.sizes.map((s) => (
            <option key={s.label} value={s.label}>
              {s.label}{s.stock <= 0 ? ' (out of stock)' : ''}
            </option>
          ))}
        </select>

        <div className="price-row">
          <span className="price">{formatProductPrice(getEffectivePrice(activeSize, isWholesale), product, activeSize.label)}</span>
          {activeSize.mrp > activeSize.price && <span className="mrp">{formatPrice(activeSize.mrp)}</span>}
          {discount > 0 && <span className="off">{discount}% off</span>}
          {isWholesalePriceApplied(activeSize, isWholesale) && <span className="off wholesale-badge">Wholesale price</span>}
        </div>

        {outOfStock ? (
          <>
            <div className="out-of-stock-notice">Currently stock not available</div>
            <div className="notify-stock-row" onClick={(e) => e.preventDefault()}>
              {notifyState === 'done' ? (
                <span className="muted" style={{ fontSize: '0.78rem' }}>🔔 We'll email you when it's back.</span>
              ) : (
                <>
                  {!isLoggedIn && notifyOpen && (
                    <input
                      type="email"
                      placeholder="Your email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <button type="button" className="link-btn" onClick={handleNotifyMe} disabled={notifyState === 'submitting'}>
                    {notifyState === 'submitting' ? 'Submitting…' : '🔔 Notify me when back in stock'}
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="product-actions">
            <button className="btn btn-forest btn-sm" onClick={handleBuyNow}>
              Buy Now
            </button>
            <button className="btn btn-gold btn-sm" onClick={handleAdd}>
              Add to cart
            </button>
          </div>
        )}
      </div>
    </Link>
  );
}
