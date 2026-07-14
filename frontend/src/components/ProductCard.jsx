import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProductImage } from '../utils/productImages';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { IconHeart } from './Icons';

export default function ProductCard({ product }) {
  const { productIds, toggleWishlist } = useWishlist();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [size, setSize] = useState(product.sizes[1]?.label || product.sizes[0].label);

  const isWished = productIds.includes(product.id);
  const activeSize = product.sizes.find((s) => s.label === size) || product.sizes[0];
  const discount = Math.round(((activeSize.mrp - activeSize.price) / activeSize.mrp) * 100);

  function handleAdd(e) {
    e.preventDefault();
    addItem(product.id, size, 1);
    showToast(`${product.name} (${size}) added to cart`);
  }

  function handleBuyNow(e) {
    e.preventDefault();
    navigate('/cart', { state: { buyNow: { productId: product.id, size, quantity: 1 } } });
  }

  function handleWishlist(e) {
    e.preventDefault();
    toggleWishlist(product.id);
    showToast(isWished ? `Removed from wishlist` : `${product.name} added to wishlist`);
  }

  return (
    <Link to={`/product/${product.id}`} className="product-card">
      <div className="product-media">
        {discount > 0 && <span className="product-badge">{discount}% OFF</span>}
        <button
          className={`wishlist-toggle ${isWished ? 'active' : ''}`}
          aria-label={isWished ? 'Remove from wishlist' : 'Add to wishlist'}
          onClick={handleWishlist}
        >
          <IconHeart filled={isWished} size={17} />
        </button>
        <img src={getProductImage(product.image)} alt={product.name} loading="lazy" />
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
          <span className="price">₹{activeSize.price}</span>
          {activeSize.mrp > activeSize.price && <span className="mrp">₹{activeSize.mrp}</span>}
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
