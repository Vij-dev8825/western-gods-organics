import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { recordProductView } from '../utils/recentlyViewed';
import { trackViewItem } from '../utils/analytics';
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
import { STORE_LOCATIONS } from '../data/storeLocations';
import { flyToCart } from '../utils/flyToCart';
import { useReveal } from '../hooks/useReveal';
import FadeImage from '../components/FadeImage';
import { HERO_CLASS } from '../utils/viewTransition';

const SUBSCRIPTION_DISCOUNT_PERCENT = 10;
const MIN_FREQUENCY_DAYS = 7;
const MAX_FREQUENCY_DAYS = 180;
const MAX_REVIEW_PHOTOS = 4;
const LOW_STOCK_THRESHOLD = 10;
const SUPPORT_PHONE = '+918825875607';
const RECENT_ORDER_WINDOW_LABEL = '2 days'; // mirrors backend RECENT_ORDER_WINDOW_HOURS (48h)
// Below this, five bars of mostly zero tell a shopper less than just reading
// the two reviews would, and make a thin reviews section look thinner.
const RATING_BREAKDOWN_MIN = 3;

/** A still from a stored clip, via the poster route media.js already serves.
 *  Only database-stored media has one — a Cloudinary or /uploads URL falls back
 *  to the browser's own first frame, which is what it would have shown anyway. */
function posterFor(video) {
  const match = /^\/api\/media\/([^/?]+)/.exec(video || '');
  return match ? `/api/media/${match[1]}/poster` : undefined;
}
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

// A ribbon reading "pressed 8 months ago" undercuts freshness instead of
// signaling it, so only lead with elapsed time for genuinely recent batches —
// older ones still link through to the batch passport, just without an age
// callout that would read as stale. Returns null outside that window.
const RECENT_BATCH_DAYS = 60;
function recentHarvestLabel(productionDate) {
  const days = Math.floor((Date.now() - new Date(productionDate).getTime()) / 86400000);
  if (days < 0 || days > RECENT_BATCH_DAYS) return null;
  if (days === 0) return 'pressed today';
  if (days === 1) return 'pressed yesterday';
  if (days < 14) return `pressed ${days} days ago`;
  return `pressed ${Math.round(days / 7)} weeks ago`;
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
  const [monthlyUsage, setMonthlyUsage] = useState(500); // ml/g per month, for the cost comparison slider
  const [pressings, setPressings] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const mediaRef = useRef(null);
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
  const actionsRef = useRef(null);
  const [buyBarVisible, setBuyBarVisible] = useState(false);
  // The blocks below the fold arrived fully formed while the home page's
  // equivalents rose into view — the same primitive, just never wired up
  // here. Applied to the elements themselves rather than through <Reveal>,
  // which would add a wrapper between the page and blocks that are already
  // positioned as its direct children.
  const reviewsReveal = useReveal();
  const questionsReveal = useReveal();
  const guidesReveal = useReveal();
  const { addItem } = useCart();
  const { productIds, toggleWishlist } = useWishlist();
  const { isLoggedIn, token, user } = useAuth();
  const { showToast } = useToast();
  const { lang } = useLang();
  // In Tamil Nadu the Tamil name is the name, not a translation of the English
  // one — so it is entered by hand per product and falls back to English until
  // it is. See utils/productLocale.js for the lookup.
  const displayName = localizeProductText(product, 'name', lang) || product?.name || '';
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
      const defaultSize = d.product.sizes[1] || d.product.sizes[0];
      setSize(defaultSize.label);
      // Failure here is silent on purpose: an upcoming pressing is a bonus
      // offer, and a page that can't load one should still sell what's in stock.
      api.getOpenPressings(d.product.id).then((r) => setPressings(r.pressings)).catch(() => {});
      setQty(1);
      setActiveImage(0);
      recordProductView(d.product.id);
      // Sent on load with the size the page opens on, not on every size
      // change — this measures "someone looked at this product", and firing
      // it again each time they flick between 500ml and 1L would inflate the
      // count and muddy the retargeting audience it feeds.
      trackViewItem({
        id: d.product.id,
        name: d.product.name,
        price: defaultSize.price,
        size: defaultSize.label,
      });

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

  // The sticky buy bar only earns its place once the real Add-to-cart button
  // has scrolled away — showing both at once would cover the page with a
  // second copy of a button already under the reader's thumb. Watches the
  // action row rather than a scroll offset, so it stays right whatever the
  // page above it happens to be (early-access notice, kit callout, pressing).
  useEffect(() => {
    const row = actionsRef.current;
    const sizes = product?.sizes || [];
    const active = sizes.find((s) => s.label === size) || sizes[0];
    // A sold-out size renders no bar at all, so don't report one as showing —
    // the body class below would otherwise lift the floating buttons to make
    // room for something that isn't there. Re-runs on size for the same reason.
    if (!row || !active || active.stock <= 0 || typeof IntersectionObserver === 'undefined') {
      setBuyBarVisible(false);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setBuyBarVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    );
    observer.observe(row);
    return () => observer.disconnect();
  }, [product?.id, size]);

  // The floating chat/WhatsApp/AI buttons live outside this page's tree, so
  // the only way to move them out of the bar's way is a class on <body>.
  // Removed on unmount as well as on hide, or leaving the page mid-scroll
  // would strand them a bar's height up on every other screen.
  useEffect(() => {
    document.body.classList.toggle('buy-bar-up', buyBarVisible);
    return () => document.body.classList.remove('buy-bar-up');
  }, [buyBarVisible]);

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
    // Arriving from a product card, the photograph came with the navigation,
    // so show it rather than a spinner. This is also what makes the morph
    // connect at all: the browser snapshots the incoming page the moment the
    // navigation commits, and the fetch has not resolved by then — without
    // something here to receive it, the animation would land on the spinner.
    const preview = location.state?.heroImage;
    if (!preview) {
      return (
        <div className="center" style={{ padding: '120px 0' }}>
          <ChakkiWheel size={56} />
        </div>
      );
    }
    return (
      <div className="container">
        <div className="product-detail-grid">
          <div className="product-media" style={{ borderRadius: 'var(--radius-lg)' }}>
            <img className={HERO_CLASS} src={preview} alt={location.state?.heroName || ''} />
          </div>
          <div className="center" style={{ padding: '60px 0' }}>
            <ChakkiWheel size={56} />
          </div>
        </div>
      </div>
    );
  }

  const freshBatchLabel = product.productionDate ? recentHarvestLabel(product.productionDate) : null;
  const activeSize = product.sizes.find((s) => s.label === size) || product.sizes[0];
  const discount = Math.round(((activeSize.mrp - activeSize.price) / activeSize.mrp) * 100);
  const outOfStock = activeSize.stock <= 0;
  const ourPer100 = pricePer100(activeSize.price, activeSize.label);
  const per100Unit = parseSizeLabel(activeSize.label)?.unit;
  const marketPer100 = product.marketPricePer100 > 0 ? product.marketPricePer100 : null;
  const hasBatchInfo = Boolean(
    product.batchNumber || product.productionDate || product.bestBeforeDate ||
    product.fssaiLicense || product.labReportUrl || product.inciIngredients ||
    product.growerName || product.growerVillage
  );
  const isWished = productIds.includes(product.id);
  // Pressings are scheduled per size, so only a run for the size on screen is
  // relevant; the soonest one wins if several are open.
  const nextPressing = pressings.find((p) => p.size === activeSize.label) || null;
  const gallery = product.images?.length ? product.images : [product.image];
  const productSchema = buildProductSchema(product);

  /**
   * Points the zoom at whatever the cursor is over, by writing the cursor
   * position onto the frame as custom properties the stylesheet reads as a
   * transform-origin. The magnification itself is pure CSS :hover — only the
   * origin needs to know where the pointer is.
   *
   * Written straight to the node rather than held in state: this fires on
   * every mouse move, and a setState here would re-render the whole product
   * page — gallery, reviews, related products — dozens of times a second to
   * move one image a few pixels.
   */
  function handleZoomMove(e) {
    const frame = mediaRef.current;
    if (!frame) return;
    const box = frame.getBoundingClientRect();
    frame.style.setProperty('--zoom-x', `${((e.clientX - box.left) / box.width) * 100}%`);
    frame.style.setProperty('--zoom-y', `${((e.clientY - box.top) / box.height) * 100}%`);
  }

  function handleAdd() {
    if (outOfStock) return;
    flyToCart(document.querySelector('.product-media-zoomable img'));
    addItem(product.id, size, qty);
    showToast(`${product.name} (${size}) ×${qty} added to cart`);
  }

  function handleBuyNow() {
    if (outOfStock) return;
    navigate('/cart', { state: { buyNow: { productId: product.id, size, quantity: qty } } });
  }

  /** Reserving goes through the same single-item Buy Now route rather than the
   * cart, which is what keeps a reservation from ever being mixed in with
   * in-stock items — an order that's half "ships today" and half "ships after
   * the 15th" has no honest delivery date to show. */
  function handleReserve() {
    if (!nextPressing) return;
    navigate('/cart', {
      state: {
        buyNow: {
          productId: product.id,
          size,
          quantity: Math.min(qty, nextPressing.unitsRemaining),
          pressingId: nextPressing.id,
        },
      },
    });
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
        title={`${displayName} | Western Gods Organics`}
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
        <Link to="/shop">Shop</Link> / {displayName}
      </div>

      <div className="product-detail-grid">
        <div>
          <button
            type="button"
            ref={mediaRef}
            className="product-media product-media-zoomable"
            style={{ borderRadius: 'var(--radius-lg)' }}
            onClick={() => setLightboxOpen(true)}
            onMouseMove={handleZoomMove}
            aria-label="View larger image"
          >
            {discount > 0 && <span className="product-badge">{discount}% OFF</span>}
            {/* Receives the photograph travelling in from the product card,
                and hands it back when you tap through to a related product. */}
            <FadeImage
              className={activeImage === 0 ? HERO_CLASS : undefined}
              src={getProductImage(gallery[activeImage])}
              alt={displayName}
            />
            {/* Two hints, one shown per input type. A phone has no cursor to
                magnify under, so it keeps the tap-to-open-full-screen route. */}
            <span className="product-media-zoom-hint hint-touch">🔍 Tap to zoom</span>
            <span className="product-media-zoom-hint hint-pointer">🔍 Move over the photo to zoom</span>
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
          {/* The mill's own footage. A poster frame is pulled from the stored
              clip so this shows the press rather than a black rectangle while
              megabytes buffer on a village connection — the same reasoning as
              the hero video, and the route already existed. */}
          {product.video && (
            <figure className="product-video">
              <video
                src={getProductImage(product.video)}
                poster={posterFor(product.video)}
                controls
                playsInline
                preload="metadata"
              />
              <figcaption>Pressed at our own mill in Udumalpet — sound on.</figcaption>
            </figure>
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
          <h1>{displayName}</h1>
          {product.batchNumber && (
            <Link to={`/batch/${encodeURIComponent(product.batchNumber)}`} className="harvest-ribbon">
              🌿 Batch {product.batchNumber}
              {freshBatchLabel && ` · ${freshBatchLabel}${!product.sellerName ? ` in ${STORE_LOCATIONS[0].locality}` : ''}`}
              <span aria-hidden="true"> →</span>
            </Link>
          )}
          {product.sellerName && (
            <p className="muted" style={{ fontSize: '0.85rem', margin: '2px 0 8px' }}>
              {/* Only a marketplace seller is the seller of record. A supplier
                  sells to us and we sell it on, so claiming they sold it to the
                  shopper would be wrong — they're credited as the maker. */}
              {product.sellerMode === 'marketplace' ? 'Sold by ' : 'Made by '}
              <Link to={`/sellers/${product.sellerId}`}>{product.sellerName}</Link>
            </p>
          )}
          {/* Named here, beside the price, rather than only in the compliance
              list at the foot of the page. "Organic" is a word anyone can
              print; a grower and a village is a specific, checkable claim, and
              it is worth nothing to a buyer who never scrolls far enough to
              find it. Only shown for the mill's own goods — a seller's product
              already carries their name two lines above. */}
          {!product.sellerName && (product.growerName || product.growerVillage) && (
            <p className="grower-line">
              <span aria-hidden="true">🌾</span> Grown by{' '}
              <b>{product.growerName || 'a farmer we buy from directly'}</b>
              {product.growerVillage && <> in {product.growerVillage}</>}
            </p>
          )}
          {/* Same rule as the product cards: no reviews, no rating. The
              reviews section further down invites the first one. */}
          {product.reviewsCount > 0 && (
            <div className="rating-row" style={{ marginBottom: 16 }}>
              ★ {product.rating}{' '}
              <span className="count">
                ({product.reviewsCount} {product.reviewsCount === 1 ? 'review' : 'reviews'})
              </span>
            </div>
          )}
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
          {!isForeign && ourPer100 != null && marketPer100 && (() => {
            // Round each displayed figure first, then diff those — otherwise the
            // savings line can be off by a rupee from what "supermarket minus
            // ours" looks like using the two numbers actually shown above it.
            const ourMonthly = Math.round((ourPer100 / 100) * monthlyUsage);
            const marketMonthly = Math.round((marketPer100 / 100) * monthlyUsage);
            const monthlySavings = marketMonthly - ourMonthly;
            return (
              <div className="cost-compare" style={{ marginTop: -12, marginBottom: 18 }}>
                <p className="muted" style={{ fontSize: '0.82rem', marginBottom: 10 }}>
                  You pay ₹{ourPer100.toFixed(0)} per 100{per100Unit} — typical supermarket refined
                  versions average ~₹{marketPer100.toFixed(0)}.
                </p>
                <label className="cost-compare-slider">
                  <span>If you use <b>{monthlyUsage}{per100Unit}</b> a month:</span>
                  <input
                    type="range"
                    min={100}
                    max={2000}
                    step={50}
                    value={monthlyUsage}
                    onChange={(e) => setMonthlyUsage(Number(e.target.value))}
                    aria-label={`Monthly usage in ${per100Unit}`}
                  />
                </label>
                <div className="cost-compare-result">
                  <div>
                    <span className="muted">With us</span>
                    <b>₹{ourMonthly}/mo</b>
                  </div>
                  <div>
                    <span className="muted">Supermarket</span>
                    <b>₹{marketMonthly}/mo</b>
                  </div>
                </div>
                {monthlySavings > 1 && (
                  <p className="cost-compare-savings">You save ₹{monthlySavings}/month at this usage</p>
                )}
              </div>
            );
          })()}

          <div className="flex gap-1 product-actions-row" ref={actionsRef} style={{ marginBottom: 22 }}>
            {!outOfStock && (
              <div className="qty-stepper">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
                <span>{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity">+</button>
              </div>
            )}
            {outOfStock ? (
              <div className="out-of-stock-notice">
                {nextPressing ? 'Sold out — but the next pressing is open' : 'Currently stock not available'}
              </div>
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

          {/* On a phone, the buy button scrolls out of reach the moment someone
              opens the description or the reviews — which is exactly when they
              are deciding. This bar keeps the price and the action in the
              thumb's path, the same pattern the cart page already uses.
              Calls the same handler, so there is one add-to-cart, not two. */}
          {!outOfStock && (
            <div className={`buy-bar${buyBarVisible ? ' visible' : ''}`} aria-hidden={!buyBarVisible}>
              <div className="buy-bar-price">
                <b>{formatProductPrice(getEffectivePrice(activeSize, isWholesale), product, activeSize.label)}</b>
                <span className="muted">{activeSize.label}</span>
              </div>
              <button className="btn btn-gold" onClick={handleAdd} tabIndex={buyBarVisible ? 0 : -1}>
                Add to cart
              </button>
            </div>
          )}

          {/* Reserve a share of the next run of the mill. Shown for the
              selected size only, because a pressing is scheduled per size —
              the 500 ml run and the 5 L run are different days' work. */}
          {nextPressing && (
            <div className="pressing-panel">
              <span className="pressing-eyebrow">Next pressing</span>
              <h4>
                Pressing on {new Date(nextPressing.pressDate).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </h4>
              <p className="muted">
                This oil hasn't been pressed yet. Reserve a bottle from the run and it's
                yours the day it comes off the wood press — you'll get its batch number
                once it's done.
              </p>
              {nextPressing.note && <p className="pressing-note">“{nextPressing.note}”</p>}
              <div className="pressing-meter">
                <div
                  className="pressing-meter-fill"
                  style={{ width: `${Math.min(100, Math.round((nextPressing.reserved / nextPressing.unitsOffered) * 100))}%` }}
                />
              </div>
              <p className="pressing-count">
                <b>{nextPressing.unitsRemaining}</b> of {nextPressing.unitsOffered} bottles left in this run
              </p>
              <button className="btn btn-forest btn-block" onClick={handleReserve}>
                Reserve {qty > 1 ? `${qty} bottles` : 'a bottle'} — {formatPrice(activeSize.price * qty)}
              </button>
              <p className="muted pressing-terms">
                Paid online now, so we can buy the seed for this run. Nothing is collected on delivery.
              </p>
            </div>
          )}

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
                {(product.growerName || product.growerVillage) && (
                  <li>
                    <b>Grown by:</b> {product.growerName || 'A farmer we buy from'}
                    {product.growerVillage && `, ${product.growerVillage}`}
                  </li>
                )}
                {product.fssaiLicense && <li><b>FSSAI license:</b> {product.fssaiLicense}</li>}
                {product.labReportUrl && (
                  <li><a href={product.labReportUrl} target="_blank" rel="noreferrer">View lab report →</a></li>
                )}
                {product.inciIngredients && <li><b>Ingredients:</b> {product.inciIngredients}</li>}
              </ul>
              {product.batchNumber && (
                <a
                  href={`https://wa.me/${SUPPORT_PHONE.replace('+', '')}?text=${encodeURIComponent(
                    `Hi, I have a question about ${product.name} — batch ${product.batchNumber}.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: 10 }}
                >
                  💬 Ask about this batch on WhatsApp
                </a>
              )}
              {product.sellerName && (
                <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
                  {product.sellerMode === 'marketplace'
                    ? `Provided by ${product.sellerName}, who makes this product.`
                    : `As told to us by ${product.sellerName}, who makes this product. Sold by Western Gods Organics.`}
                </p>
              )}
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
      <div
        ref={reviewsReveal.ref}
        className={`reviews-section reveal ${reviewsReveal.visible ? 'reveal-visible' : ''}`}
      >
        <h2>Customer Reviews</h2>

        {/* An average hides its own shape: 4.2 out of forties and fives is a
            different product from 4.2 out of fives and a one, and the second
            is what a careful shopper is looking for. Counted from the reviews
            already loaded, so no extra request. Held back below three, where
            five bars of mostly zero says less than the reviews themselves. */}
        {reviews.length >= RATING_BREAKDOWN_MIN && (
          <div className="rating-breakdown">
            <div className="rating-breakdown-score">
              <b>{(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}</b>
              <span className="muted">{reviews.length} review{reviews.length === 1 ? '' : 's'}</span>
            </div>
            <div className="rating-breakdown-bars">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviews.filter((r) => r.rating === star).length;
                const share = count / reviews.length;
                return (
                  <div className="rating-breakdown-row" key={star}>
                    <span className="rating-breakdown-label">{star}★</span>
                    <span className="rating-breakdown-track">
                      <span className="rating-breakdown-fill" style={{ width: `${Math.round(share * 100)}%` }} />
                    </span>
                    <span className="rating-breakdown-count">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
      <div
        ref={questionsReveal.ref}
        className={`reviews-section reveal ${questionsReveal.visible ? 'reveal-visible' : ''}`}
      >
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
        <div
          ref={guidesReveal.ref}
          className={`related-section reveal ${guidesReveal.visible ? 'reveal-visible' : ''}`}
        >
          <h2>Usage Guides</h2>
          <div className="blog-grid">
            {guides.map((g) => (
              <Link key={g.id} to={`/blog/${g.id}`} className="blog-card">
                <div className="blog-card-media">
                  <FadeImage src={getProductImage(g.image)} alt={g.title} loading="lazy" />
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
