import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProductImage } from '../utils/productImages';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { IconHeart } from './Icons';

export default function ProductCard({ product }) {
  const { productIds, toggleWishlist } = useWishlist();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const { formatPrice, formatProductPrice } = useCurrency();
  const navigate = useNavigate();
  const [size, setSize] = useState(product.sizes[1]?.label || product.sizes[0].label);
  const [hoverIndex, setHoverIndex] = useState(0);
  const [qty, setQty] = useState(1);

  const gallery = product.images?.length ? product.images : [product.image];
  const isWished = productIds.includes(product.id);
  const activeSize = product.sizes.find((s) => s.label === size) || product.sizes[0];
  const discount = Math.round(((activeSize.mrp - activeSize.price) / activeSize.mrp) * 100);

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
    addItem(product.id, size, qty);
    showToast(`${product.name} (${size}) ×${qty} added to cart`);
  }

  function handleBuyNow(e) {
    e.preventDefault();
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
    showToast(isWished ? `Removed from wishlist` : `${product.name} added to wishlist`);
  }

  return (
    <Link to={`/product/${product.id}`} className="product-card">
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
        <img src={getProductImage(gallery[hoverIndex])} alt={product.name} loading="lazy" />

        <div className="product-media-quickadd">
          <div className="qty-stepper qty-stepper-sm" onClick={(e) => e.preventDefault()}>
            <button onClick={(e) => stepQty(e, -1)} aria-label="Decrease quantity">−</button>
            <span>{qty}</span>
            <button onClick={(e) => stepQty(e, 1)} aria-label="Increase quantity">+</button>
          </div>
          <button className="btn btn-gold btn-sm" onClick={handleAdd}>Add to cart</button>
        </div>
      </div>
      <div className="product-body">
        <h3>{product.name}</h3>
        <p className="product-desc">{product.shortDescription}</p>
        <div className="rating-row">
          ★ {product.rating} <span className="count">({product.reviewsCount})</span>
        </div>

        <select
          className="select"
          value={size}
          onClick={(e) => e.preventDefault()}
          onChange={(e) => setSize(e.target.value)}
          aria-label="Select size"
        >
          {product.sizes.map((s) => (
            <option key={s.label} value={s.label}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="price-row">
          <span className="price">{formatProductPrice(activeSize.price, product, activeSize.label)}</span>
          {activeSize.mrp > activeSize.price && <span className="mrp">{formatPrice(activeSize.mrp)}</span>}
          {discount > 0 && <span className="off">{discount}% off</span>}
        </div>

        <div className="product-actions">
          <button className="btn btn-forest btn-sm" onClick={handleBuyNow}>
            Buy Now
          </button>
          <button className="btn btn-gold btn-sm" onClick={handleAdd}>
            Add to cart
          </button>
        </div>
      </div>
    </Link>
  );
}
