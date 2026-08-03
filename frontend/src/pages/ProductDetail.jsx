import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { recordProductView } from '../utils/recentlyViewed';
import { validateAddress } from '../utils/validators';
import { normalizeAddresses } from '../utils/addresses';
import { pricePer100, parseSizeLabel } from '../utils/sizeParsing';
import { getEffectivePrice, isWholesalePriceApplied } from '../utils/pricing';
import ChakkiWheel from '../components/ChakkiWheel';
import ProductCard from '../components/ProductCard';
import ImageLightbox from '../components/ImageLightbox';
import DeliveryEstimate from '../components/DeliveryEstimate';
import TrustBadges from '../components/TrustBadges';
import StructuredData from '../components/StructuredData';
import SeoMeta from '../components/SeoMeta';
import AddressForm from '../components/AddressForm';
import { IconHeart } from '../components/Icons';
import { CANONICAL_ORIGIN } from '../utils/site';
import { useLang } from '../i18n';
import { localizeProductText } from '../utils/productLocale';
import { buildBreadcrumbSchema } from '../utils/breadcrumbSchema';
import { GUIDE_CATEGORY } from './Blog';

const SUBSCRIPTION_DISCOUNT_PERCENT = 10;
const MIN_FREQUENCY_DAYS = 7;
const MAX_FREQUENCY_DAYS = 180;
const MAX_REVIEW_PHOTOS = 4;
const LOW_STOCK_THRESHOLD = 10;
const RECENT_ORDER_WINDOW_LABEL = '2 days'; // mirrors backend RECENT_ORDER_WINDOW_HOURS (48h)
const FREQUENCIES = [
  { days: 14, label: 'Every 2 weeks' },
  { days: 28, label: 'Every 4 weeks' },
  { days: 42, label: 'Every 6 weeks' },
];

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

// schema.org Product structured data, so Google can show price/availability/
// rating rich snippets directly in search results. Describes the product as
// a whole (all sizes via AggregateOffer) rather than whichever size is
// currently toggled in the UI — Googlebot reads a snapshot, not a live
// session, so this shouldn't chase the customer's in-page selection.
function buildProductSchema(product) {
  const prices = product.sizes.map((s) => s.price);
  const inStock = product.sizes.some((s) => s.stock > 0);
  const url = `${CANONICAL_ORIGIN}/product/${product.id}`;
  const rawImage = getProductImage(product.image);
  // Generated placeholder images are inline data: URIs, not relative paths —
  // only prepend the origin for genuinely relative URLs, or this produces a
  // broken "https://...comdata:image/svg+xml..." string for those products.
  const image = /^[a-z][a-z0-9+.-]*:/i.test(rawImage) ? rawImage : `${CANONICAL_ORIGIN}${rawImage}`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription || product.description,
    image,
    sku: product.id,
    url,
    brand: { '@type': 'Brand', name: 'Western Gods Organics' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: product.sizes.length,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      // Handmade/small-batch goods, always sold new — never used/refurbished.
      itemCondition: 'https://schema.org/NewCondition',
      // No fixed sale end date, so roll this forward a year from whenever a
      // crawler reads it rather than hardcoding a date that goes stale.
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      seller: { '@type': 'Organization', name: 'Western Gods Organics' },
      url,
    },
  };

  // Google's guidelines say not to include AggregateRating with zero reviews.
  if (product.reviewsCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewsCount,
    };
  }

  return schema;
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [guides, setGuides] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState('');
  const [myImages, setMyImages] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewLightbox, setReviewLightbox] = useState(null); // { images, index } | null
  const [questions, setQuestions] = useState([]);
  const [kits, setKits] = useState([]);
  const [earlyAccessTeaser, setEarlyAccessTeaser] = useState(null);
  const [myQuestion, setMyQuestion] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [subFrequency, setSubFrequency] = useState(28);
  const [subCustom, setSubCustom] = useState(false);
  const [subCustomDays, setSubCustomDays] = useState('');
  const [subShowForm, setSubShowForm] = useState(false);
  const { formatPrice, formatProductPrice, isForeign, country } = useCurrency();
  const [subAddress, setSubAddress] = useState({ line1: '', city: '', state: '', pincode: '', phone: '', country: country.code });
  const [subAddressErrors, setSubAddressErrors] = useState({});
  const [subscribing, setSubscribing] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyState, setNotifyState] = useState('idle'); // idle | submitting | done
  const { addItem } = useCart();
  const { productIds, toggleWishlist } = useWishlist();
  const { isLoggedIn, token, user } = useAuth();
  const { showToast } = useToast();
  const { lang } = useLang();
  const isWholesale = !!user?.isWholesale;

  useEffect(() => {
    setProduct(null);
    setReviews([]);
    setQuestions([]);
    setKits([]);
    setEarlyAccessTeaser(null);
    setMyQuestion('');
    setMyRating(0);
    setMyText('');
    setMyImages([]);
    api.getProduct(id, token).then((d) => {
      if (d.earlyAccess) {
        setEarlyAccessTeaser(d.product);
        return;
      }
      setProduct(d.product);
      setSize(d.product.sizes[1]?.label || d.product.sizes[0].label);
      setQty(1);
      setActiveImage(0);
      recordProductView(d.product.id);

      api
        .getProducts({ category: d.product.category }, token)
        .then((r) => setRelated(r.products.filter((p) => p.id !== d.product.id).slice(0, 4)))
        .catch(() => {});

      // Simple keyword match on guide titles (e.g. a product named "Cold-
      // Pressed Castor Oil" matches a guide titled "5 Ways to Use Castor Oil
      // for Hair") — no separate product-linking field needed.
      const nameWords = d.product.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      api
        .getBlogPosts()
        .then((r) => {
          const matches = r.posts.filter(
            (p) => p.category === GUIDE_CATEGORY && nameWords.some((w) => p.title.toLowerCase().includes(w))
          );
          setGuides(matches.slice(0, 3));
        })
        .catch(() => {});

      // comboProductIds is a structured link (unlike the free-text
      // comboItems) — find any kit that lists this product as a component
      // so its own page can point back to the kit.
      api
        .getProducts({ combo: true }, token)
        .then((r) => setKits(r.products.filter((p) => p.comboProductIds?.includes(d.product.id))))
        .catch(() => {});
    });
    api.getReviews(id).then((d) => setReviews(d.reviews)).catch(() => {});
    api.getProductQuestions(id).then((d) => setQuestions(d.questions)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!user) return;
    const mine = reviews.find((r) => r.userId === user.id);
    if (mine) {
      setMyRating(mine.rating);
      setMyText(mine.text || '');
      setMyImages(mine.images || []);
    }
  }, [reviews, user]);

  // Addresses saved before the country field existed won't have one —
  // default to the current browsing country rather than leaving it
  // undefined (see the same fix in Cart.jsx for the full reasoning).
  useEffect(() => {
    const addresses = normalizeAddresses(user?.addresses);
    if (addresses.length) {
      const def = addresses.find((a) => a.isDefault) || addresses[0];
      setSubAddress({ ...def, country: def.country || country.code });
    }
  }, [user]);

  useEffect(() => {
    setNotifyState('idle');
    setNotifyEmail('');
  }, [size]);

  if (earlyAccessTeaser) {
    const launchDate = new Date(earlyAccessTeaser.earlyAccessUntil).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    return (
      <div className="container section">
        <div className="empty-state">
          {earlyAccessTeaser.image && (
            <img
              src={getProductImage(earlyAccessTeaser.image)}
              alt={earlyAccessTeaser.name}
              style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 16 }}
            />
          )}
          <span className="eyebrow">Coming soon</span>
          <h2>{earlyAccessTeaser.name}</h2>
          {earlyAccessTeaser.shortDescription && <p className="muted">{earlyAccessTeaser.shortDescription}</p>}
          <p className="muted">Launches for everyone on {launchDate}.</p>
          <p className="muted">
            Silver &amp; Gold reward members get early access and can shop it right now.{' '}
            <Link to="/profile">Check your tier →</Link>
          </p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  const activeSize = product.sizes.find((s) => s.label === size) || product.sizes[0];
  const discount = Math.round(((activeSize.mrp - activeSize.price) / activeSize.mrp) * 100);
  const outOfStock = activeSize.stock <= 0;
  const ourPer100 = pricePer100(activeSize.price, activeSize.label);
  const per100Unit = parseSizeLabel(activeSize.label)?.unit;
  const marketPer100 = product.marketPricePer100 > 0 ? product.marketPricePer100 : null;
  const hasBatchInfo = Boolean(
    product.batchNumber || product.productionDate || product.bestBeforeDate ||
    product.fssaiLicense || product.labReportUrl || product.inciIngredients
  );
  const isWished = productIds.includes(product.id);
  const gallery = product.images?.length ? product.images : [product.image];
  const productSchema = buildProductSchema(product);

  function handleAdd() {
    if (outOfStock) return;
    addItem(product.id, size, qty);
    showToast(`${product.name} (${size}) ×${qty} added to cart`);
  }

  function handleBuyNow() {
    if (outOfStock) return;
    navigate('/cart', { state: { buyNow: { productId: product.id, size, quantity: qty } } });
  }

  function handleWishlist() {
    toggleWishlist(product.id);
    showToast(isWished ? 'Removed from wishlist' : `${product.name} added to wishlist`);
  }

  async function handleNotifyMe(e) {
    e.preventDefault();
    if (!isLoggedIn && !notifyEmail.trim()) {
      showToast('Enter an email address to be notified.', 'error');
      return;
    }
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

  const effectiveFrequencyDays = subCustom ? Number(subCustomDays) || 0 : subFrequency;
  const customDaysValid =
    !subCustom || (Number.isInteger(Number(subCustomDays)) && effectiveFrequencyDays >= MIN_FREQUENCY_DAYS && effectiveFrequencyDays <= MAX_FREQUENCY_DAYS);

  function handleSubscribeClick() {
    if (outOfStock) return;
    if (!isLoggedIn) {
      navigate('/login', { state: { from: `/product/${id}` } });
      return;
    }
    setSubShowForm(true);
  }

  function updateSubAddress(field, value) {
    setSubAddress((a) => ({ ...a, [field]: value }));
    setSubAddressErrors((errs) => (errs[field] ? { ...errs, [field]: undefined } : errs));
  }

  async function handleSubscribeSubmit(e) {
    e.preventDefault();
    if (outOfStock) return;
    if (!customDaysValid) {
      showToast(`Enter a custom frequency between ${MIN_FREQUENCY_DAYS} and ${MAX_FREQUENCY_DAYS} days.`, 'error');
      return;
    }
    const errors = validateAddress(subAddress);
    setSubAddressErrors(errors);
    if (Object.keys(errors).length) {
      showToast('Please fix the highlighted fields in your delivery address.', 'error');
      return;
    }
    setSubscribing(true);
    try {
      await api.createSubscription(token, {
        productId: product.id,
        size,
        quantity: qty,
        frequencyDays: effectiveFrequencyDays,
        address: subAddress,
      });
      showToast('Subscription started! Manage it anytime from My Subscriptions.');
      navigate('/subscriptions');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubscribing(false);
    }
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (!myRating) {
      showToast('Pick a star rating first.', 'error');
      return;
    }
    setSubmittingReview(true);
    try {
      await api.submitReview(token, product.id, { rating: myRating, text: myText, images: myImages });
      const d = await api.getReviews(id);
      setReviews(d.reviews);
      const p = await api.getProduct(id, token);
      setProduct(p.product);
      showToast('Thanks for your review!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingReview(false);
    }
  }

  async function handleSubmitQuestion(e) {
    e.preventDefault();
    if (myQuestion.trim().length < 5) {
      showToast('Please enter a question (at least 5 characters).', 'error');
      return;
    }
    setSubmittingQuestion(true);
    try {
      await api.askProductQuestion(token, product.id, myQuestion.trim());
      setMyQuestion('');
      showToast("Thanks — we'll answer it soon and email you.");
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmittingQuestion(false);
    }
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (myImages.length >= MAX_REVIEW_PHOTOS) {
      showToast(`You can attach up to ${MAX_REVIEW_PHOTOS} photos.`, 'error');
      return;
    }
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.uploadReviewPhoto(token, formData);
      setMyImages((imgs) => [...imgs, res.url]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function removeMyImage(idx) {
    setMyImages((imgs) => imgs.filter((_, i) => i !== idx));
  }

  return (
    <div className="container section">
      <SeoMeta
        title={`${product.name} | Western Gods Organics`}
        description={(localizeProductText(product, 'shortDescription', lang) || localizeProductText(product, 'description', lang)).slice(0, 160)}
        // Placeholder products use an inline data: URI image — social-share
        // crawlers can't fetch that as an og:image, so fall back to the
        // site logo instead of a link preview with a broken picture.
        image={productSchema.image.startsWith('http') ? productSchema.image : undefined}
        type="product"
        path={`/product/${product.id}`}
        price={productSchema.offers.lowPrice}
        availability={productSchema.offers.availability.endsWith('InStock') ? 'instock' : 'oos'}
      />
      <StructuredData id="ld-product" data={productSchema} />
      <StructuredData
        id="ld-breadcrumb"
        data={buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Shop', path: '/shop' },
          { name: product.name, path: `/product/${product.id}` },
        ])}
      />
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
          {new Date(product.earlyAccessUntil || 0).getTime() > Date.now() && (
            <p className="muted" style={{ fontSize: '0.8rem', margin: '4px 0' }}>
              ⭐ Early access — this launches for everyone on{' '}
              {new Date(product.earlyAccessUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}.
              You're seeing it early as a Silver/Gold reward member.
            </p>
          )}
          <h1>{product.name}</h1>
          {product.sellerName && (
            <p className="muted" style={{ fontSize: '0.85rem', margin: '2px 0 8px' }}>Sold by {product.sellerName}</p>
          )}
          <div className="rating-row" style={{ marginBottom: 16 }}>
            ★ {product.rating} <span className="count">({product.reviewsCount} reviews)</span>
          </div>
          <p className="muted">{localizeProductText(product, 'description', lang)}</p>

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

          {kits.length > 0 && (
            <div className="combo-includes">
              <span className="eyebrow">Part of a kit</span>
              <ul>
                {kits.map((k) => (
                  <li key={k.id}>
                    <Link to={`/product/${k.id}`}>{k.name}</Link> — save by buying the full kit
                  </li>
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
                  className={`btn btn-sm ${size === s.label ? 'btn-forest' : 'btn-outline'} ${s.stock <= 0 ? 'size-out-of-stock' : ''}`}
                  onClick={() => setSize(s.label)}
                >
                  {s.label}{s.stock <= 0 ? ' (out of stock)' : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="price-row" style={{ margin: '18px 0' }}>
            <span className="price" style={{ fontSize: '1.6rem' }}>{formatProductPrice(getEffectivePrice(activeSize, isWholesale), product, activeSize.label)}</span>
            {activeSize.mrp > activeSize.price && <span className="mrp">{formatPrice(activeSize.mrp)}</span>}
            {discount > 0 && <span className="off">{discount}% off</span>}
            {isWholesalePriceApplied(activeSize, isWholesale) && <span className="off wholesale-badge">Wholesale price</span>}
          </div>
          {isForeign && (
            <p className="muted" style={{ marginTop: -12, marginBottom: 18, fontSize: '0.8rem' }}>
              Reference price — you'll be charged in ₹ (INR) at checkout.
            </p>
          )}
          {!isForeign && ourPer100 != null && marketPer100 && (
            <p className="muted" style={{ marginTop: -12, marginBottom: 18, fontSize: '0.82rem' }}>
              You pay ₹{ourPer100.toFixed(0)} per 100{per100Unit} — typical supermarket refined
              versions average ~₹{marketPer100.toFixed(0)}.
            </p>
          )}

          <div className="flex gap-1 product-actions-row" style={{ marginBottom: 22 }}>
            {!outOfStock && (
              <div className="qty-stepper">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
                <span>{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity">+</button>
              </div>
            )}
            {outOfStock ? (
              <div className="out-of-stock-notice">Currently stock not available</div>
            ) : (
              <>
                <button className="btn btn-forest" onClick={handleBuyNow}>Buy Now</button>
                <button className="btn btn-gold" onClick={handleAdd}>Add to cart</button>
              </>
            )}
            <button
              className={`btn btn-outline wishlist-btn-detail ${isWished ? 'active' : ''}`}
              onClick={handleWishlist}
            >
              <IconHeart filled={isWished} size={16} /> {isWished ? 'Wishlisted' : 'Wishlist'}
            </button>
          </div>

          {outOfStock ? (
            <div className="alert alert-error">
              <div>Currently stock not available</div>
              {notifyState === 'done' ? (
                <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
                  🔔 We'll email you the moment "{size}" is back in stock.
                </p>
              ) : (
                <form className="notify-stock-form" onSubmit={handleNotifyMe}>
                  {!isLoggedIn && (
                    <input
                      type="email"
                      placeholder="Your email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      required
                    />
                  )}
                  <button type="submit" className="btn btn-outline btn-sm" disabled={notifyState === 'submitting'}>
                    {notifyState === 'submitting' ? 'Submitting…' : '🔔 Notify me when back in stock'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className={`alert ${activeSize.stock <= LOW_STOCK_THRESHOLD ? 'alert-warning' : 'alert-info'}`}>
              {activeSize.stock <= LOW_STOCK_THRESHOLD
                ? `⚡ Only ${activeSize.stock} left in stock — order soon!`
                : `In stock: ${activeSize.stock} units`}
              {' '}· Delivered in {isForeign ? '10-20' : '3-5'} business days
              {product.recentOrderCount > 0 && (
                <div style={{ marginTop: 4, fontSize: '0.85rem' }}>
                  🔥 {product.recentOrderCount} {product.recentOrderCount === 1 ? 'person' : 'people'} ordered this in the last {RECENT_ORDER_WINDOW_LABEL}
                </div>
              )}
            </div>
          )}

          <DeliveryEstimate />
          <TrustBadges />

          {hasBatchInfo && (
            <div className="batch-info-card">
              <h4>Batch &amp; product info</h4>
              <ul>
                {product.batchNumber && (
                  <li>
                    <b>Batch:</b> {product.batchNumber}{' '}
                    <Link to={`/batch/${encodeURIComponent(product.batchNumber)}`}>View batch details →</Link>
                  </li>
                )}
                {product.productionDate && (
                  <li><b>Made on:</b> {new Date(product.productionDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</li>
                )}
                {product.bestBeforeDate && (
                  <li><b>Best before:</b> {new Date(product.bestBeforeDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</li>
                )}
                {product.fssaiLicense && <li><b>FSSAI license:</b> {product.fssaiLicense}</li>}
                {product.labReportUrl && (
                  <li><a href={product.labReportUrl} target="_blank" rel="noreferrer">View lab report →</a></li>
                )}
                {product.inciIngredients && <li><b>Ingredients:</b> {product.inciIngredients}</li>}
              </ul>
            </div>
          )}

          <div className="subscribe-box">
            <span className="subscribe-badge">🔁 Subscribe &amp; Save {SUBSCRIPTION_DISCOUNT_PERCENT}%</span>
            <p className="muted" style={{ margin: '6px 0 12px' }}>
              Never run out — auto-delivered on your schedule, {SUBSCRIPTION_DISCOUNT_PERCENT}% off every order.
            </p>

            {!subShowForm ? (
              <>
                <div className="frequency-chips">
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f.days}
                      type="button"
                      className={`frequency-chip ${!subCustom && subFrequency === f.days ? 'active' : ''}`}
                      onClick={() => {
                        setSubCustom(false);
                        setSubFrequency(f.days);
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`frequency-chip ${subCustom ? 'active' : ''}`}
                    onClick={() => setSubCustom(true)}
                  >
                    Custom
                  </button>
                </div>

                {subCustom && (
                  <div className="flex gap-1" style={{ alignItems: 'center', margin: '10px 0' }}>
                    <span className="muted" style={{ fontSize: '0.85rem' }}>Every</span>
                    <input
                      type="number"
                      min={MIN_FREQUENCY_DAYS}
                      max={MAX_FREQUENCY_DAYS}
                      value={subCustomDays}
                      onChange={(e) => setSubCustomDays(e.target.value)}
                      style={{ width: 70 }}
                      placeholder="e.g. 10"
                    />
                    <span className="muted" style={{ fontSize: '0.85rem' }}>days</span>
                  </div>
                )}

                <button className="btn btn-gold" style={{ marginTop: 12 }} onClick={handleSubscribeClick} disabled={outOfStock}>
                  {outOfStock
                    ? 'Currently unavailable for subscription'
                    : `Subscribe — ${formatPrice(activeSize.price * (1 - SUBSCRIPTION_DISCOUNT_PERCENT / 100))}/delivery`}
                </button>
              </>
            ) : (
              <form onSubmit={handleSubscribeSubmit} noValidate>
                {user?.addresses?.length > 0 && (
                  <p className="muted" style={{ fontSize: '0.82rem' }}>
                    Filled in from your default address — edit any field if it's changed, or manage your
                    address book from your <Link to="/profile">profile</Link>.
                  </p>
                )}
                <AddressForm address={subAddress} onChange={updateSubAddress} errors={subAddressErrors} />
                <div className="flex gap-1">
                  <button className="btn btn-forest" disabled={subscribing}>
                    {subscribing ? 'Setting up…' : 'Confirm subscription'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setSubShowForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
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
            <div className="review-photo-attach">
              {myImages.map((src, i) => (
                <div key={src + i} className="review-photo-thumb">
                  <img src={src} alt="" />
                  <button
                    type="button"
                    className="review-photo-remove"
                    onClick={() => removeMyImage(i)}
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              {myImages.length < MAX_REVIEW_PHOTOS && (
                <label className={`review-photo-add ${uploadingPhoto ? 'disabled' : ''}`}>
                  {uploadingPhoto ? '…' : '+ Photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoSelect}
                    disabled={uploadingPhoto}
                    hidden
                  />
                </label>
              )}
            </div>
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
                {r.images?.length > 0 && (
                  <div className="review-item-photos">
                    {r.images.map((src, i) => (
                      <button
                        key={src + i}
                        type="button"
                        className="review-item-photo-btn"
                        onClick={() => setReviewLightbox({ images: r.images, index: i })}
                      >
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                )}
                <span className="review-item-date muted">
                  {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------- Questions & Answers ---------- */}
      <div className="reviews-section">
        <h2>Questions &amp; Answers</h2>

        {isLoggedIn ? (
          <form className="review-form" onSubmit={handleSubmitQuestion}>
            <label className="muted" style={{ fontSize: '0.85rem' }}>Ask a question about this product</label>
            <textarea
              placeholder="e.g. Is this suitable for oily skin?"
              value={myQuestion}
              onChange={(e) => setMyQuestion(e.target.value)}
              maxLength={500}
            />
            <button type="submit" className="btn btn-gold btn-sm" disabled={submittingQuestion}>
              {submittingQuestion ? 'Submitting…' : 'Ask'}
            </button>
          </form>
        ) : (
          <p className="muted">
            <Link to="/login" state={{ from: `/product/${id}` }} className="link-btn">Log in</Link> to ask a question.
          </p>
        )}

        {questions.length === 0 ? (
          <p className="muted" style={{ marginTop: 18 }}>No questions yet — be the first to ask.</p>
        ) : (
          <ul className="review-list">
            {questions.map((q) => (
              <li key={q.id} className="review-item">
                <p><b>Q:</b> {q.question}</p>
                <p><b>A:</b> {q.answer}</p>
                <span className="review-item-date muted">
                  {new Date(q.answeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {reviewLightbox && (
        <ImageLightbox
          images={reviewLightbox.images}
          index={reviewLightbox.index}
          onIndexChange={(i) => setReviewLightbox((s) => ({ ...s, index: i }))}
          onClose={() => setReviewLightbox(null)}
        />
      )}

      {/* ---------- Usage guides ---------- */}
      {guides.length > 0 && (
        <div className="related-section">
          <h2>Usage Guides</h2>
          <div className="blog-grid">
            {guides.map((g) => (
              <Link key={g.id} to={`/blog/${g.id}`} className="blog-card">
                <div className="blog-card-media">
                  <img src={getProductImage(g.image)} alt={g.title} loading="lazy" />
                </div>
                <div className="blog-card-body">
                  <span className="blog-card-tag">{GUIDE_CATEGORY}</span>
                  <h3>{g.title}</h3>
                  <p className="muted">{g.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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
