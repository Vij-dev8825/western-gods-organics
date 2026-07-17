import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { recordProductView } from '../utils/recentlyViewed';
import ChakkiWheel from '../components/ChakkiWheel';
import ProductCard from '../components/ProductCard';
import ImageLightbox from '../components/ImageLightbox';
import { IconHeart } from '../components/Icons';

function StarPicker({ value, onChange }) {
  return (
    <div className="star-picker" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-picker-star ${n <= value ? 'filled' : ''}`}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const { addItem } = useCart();
  const { productIds, toggleWishlist } = useWishlist();
  const { isLoggedIn, token, user } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    setProduct(null);
    setReviews([]);
    setMyRating(0);
    setMyText('');
    api.getProduct(id).then((d) => {
      setProduct(d.product);
      setSize(d.product.sizes[1]?.label || d.product.sizes[0].label);
      setQty(1);
      setActiveImage(0);
      recordProductView(d.product.id);

      api
        .getProducts({ category: d.product.category })
        .then((r) => setRelated(r.products.filter((p) => p.id !== d.product.id).slice(0, 4)))
        .catch(() => {});
    });
    api.getReviews(id).then((d) => setReviews(d.reviews)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!user) return;
    const mine = reviews.find((r) => r.userId === user.id);
    if (mine) {
      setMyRating(mine.rating);
      setMyText(mine.text || '');
    }
  }, [reviews, user]);

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
  const gallery = product.images?.length ? product.images : [product.image];

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

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (!myRating) {
      showToast('Pick a star rating first.', 'error');
      return;
    }
    setSubmittingReview(true);
    try {
      await api.submitReview(token, product.id, { rating: myRating, text: myText });
      const d = await api.getReviews(id);
      setReviews(d.reviews);
      const p = await api.getProduct(id);
      setProduct(p.product);
      showToast('Thanks for your review!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div className="container section">
      <div className="breadcrumb">
        <Link to="/shop">Shop</Link> / {product.name}
      </div>

      <div className="product-detail-grid">
        <div>
          <button
            type="button"
            className="product-media product-media-zoomable"
            style={{ borderRadius: 'var(--radius-lg)' }}
            onClick={() => setLightboxOpen(true)}
            aria-label="View larger image"
          >
            {discount > 0 && <span className="product-badge">{discount}% OFF</span>}
            <img src={getProductImage(gallery[activeImage])} alt={product.name} />
            <span className="product-media-zoom-hint">🔍 Tap to zoom</span>
          </button>
          {gallery.length > 1 && (
            <div className="product-gallery-thumbs">
              {gallery.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  className={`product-gallery-thumb ${i === activeImage ? 'active' : ''}`}
                  onClick={() => setActiveImage(i)}
                  aria-label={`Show photo ${i + 1}`}
                >
                  <img src={getProductImage(img)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="eyebrow">{product.tags?.[0]?.replace('-', ' ')}</span>
          <h1>{product.name}</h1>
          <div className="rating-row" style={{ marginBottom: 16 }}>
            ★ {product.rating} <span className="count">({product.reviewsCount} reviews)</span>
          </div>
          <p className="muted">{product.description}</p>

          {product.comboItems?.length > 0 && (
            <div className="combo-includes">
              <span className="eyebrow">This combo includes</span>
              <ul>
                {product.comboItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

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

      {lightboxOpen && (
        <ImageLightbox
          images={gallery}
          index={activeImage}
          onIndexChange={setActiveImage}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* ---------- Reviews ---------- */}
      <div className="reviews-section">
        <h2>Customer Reviews</h2>

        {isLoggedIn ? (
          <form className="review-form" onSubmit={handleSubmitReview}>
            <label className="muted" style={{ fontSize: '0.85rem' }}>
              {reviews.some((r) => r.userId === user?.id) ? 'Update your review' : 'Write a review'}
            </label>
            <StarPicker value={myRating} onChange={setMyRating} />
            <textarea
              placeholder="What did you think of this product? (optional)"
              value={myText}
              onChange={(e) => setMyText(e.target.value)}
              maxLength={1000}
            />
            <button className="btn btn-gold btn-sm" disabled={submittingReview}>
              {submittingReview ? 'Saving…' : 'Submit review'}
            </button>
          </form>
        ) : (
          <p className="muted">
            <Link to="/login" state={{ from: `/product/${id}` }} className="link-btn">Log in</Link> to write a review.
          </p>
        )}

        {reviews.length === 0 ? (
          <p className="muted" style={{ marginTop: 18 }}>No reviews yet — be the first to share your thoughts.</p>
        ) : (
          <ul className="review-list">
            {reviews.map((r) => (
              <li key={r.id} className="review-item">
                <div className="review-item-head">
                  <b>{r.userName}</b>
                  <span className="review-item-stars" aria-label={`${r.rating} star rating`}>
                    {'★'.repeat(r.rating)}
                    <span className="muted">{'★'.repeat(5 - r.rating)}</span>
                  </span>
                </div>
                {r.text && <p>{r.text}</p>}
                <span className="review-item-date muted">
                  {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------- Related products ---------- */}
      {related.length > 0 && (
        <div className="related-section">
          <h2>You might also like</h2>
          <div className="grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
