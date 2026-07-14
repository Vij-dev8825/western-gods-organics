import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import ChakkiWheel from '../components/ChakkiWheel';
import { IconHeart } from '../components/Icons';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();
  const { productIds, toggleWishlist } = useWishlist();
  const { showToast } = useToast();

  useEffect(() => {
    setProduct(null);
    api.getProduct(id).then((d) => {
      setProduct(d.product);
      setSize(d.product.sizes[1]?.label || d.product.sizes[0].label);
      setQty(1);
    });
  }, [id]);

  if (!product) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  const activeSize = product.sizes.find((s) => s.label === size) || product.sizes[0];
  const discount = Math.round(((activeSize.mrp - activeSize.price) / activeSize.mrp) * 100);
  const isWished = productIds.includes(product.id);

  function handleAdd() {
    addItem(product.id, size, qty);
    showToast(`${product.name} (${size}) ×${qty} added to cart`);
  }

  function handleBuyNow() {
    navigate('/cart', { state: { buyNow: { productId: product.id, size, quantity: qty } } });
  }

  function handleWishlist() {
    toggleWishlist(product.id);
    showToast(isWished ? 'Removed from wishlist' : `${product.name} added to wishlist`);
  }

  return (
    <div className="container section">
      <div className="breadcrumb">
        <Link to="/shop">Shop</Link> / {product.name}
      </div>

      <div className="product-detail-grid">
        <div className="product-media" style={{ borderRadius: 'var(--radius-lg)' }}>
          {discount > 0 && <span className="product-badge">{discount}% OFF</span>}
          <img src={getProductImage(product.image)} alt={product.name} />
        </div>

        <div>
          <span className="eyebrow">{product.tags?.[0]?.replace('-', ' ')}</span>
          <h1>{product.name}</h1>
          <div className="rating-row" style={{ marginBottom: 16 }}>
            ★ {product.rating} <span className="count">({product.reviewsCount} reviews)</span>
          </div>
          <p className="muted">{product.description}</p>

          <div className="field">
            <label>Size</label>
            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
              {product.sizes.map((s) => (
                <button
                  key={s.label}
                  className={`btn btn-sm ${size === s.label ? 'btn-forest' : 'btn-outline'}`}
                  onClick={() => setSize(s.label)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="price-row" style={{ margin: '18px 0' }}>
            <span className="price" style={{ fontSize: '1.6rem' }}>₹{activeSize.price}</span>
            {activeSize.mrp > activeSize.price && <span className="mrp">₹{activeSize.mrp}</span>}
            {discount > 0 && <span className="off">{discount}% off</span>}
          </div>

          <div className="flex gap-1 product-actions-row" style={{ marginBottom: 22 }}>
            <div className="qty-stepper">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity">+</button>
            </div>
            <button className="btn btn-forest" onClick={handleBuyNow}>Buy Now</button>
            <button className="btn btn-gold" onClick={handleAdd}>Add to cart</button>
            <button
              className={`btn btn-outline wishlist-btn-detail ${isWished ? 'active' : ''}`}
              onClick={handleWishlist}
            >
              <IconHeart filled={isWished} size={16} /> {isWished ? 'Wishlisted' : 'Wishlist'}
            </button>
          </div>

          <div className="alert alert-info">
            In stock: {activeSize.stock} units · Delivered in 3-5 business days
          </div>
        </div>
      </div>
    </div>
  );
}
