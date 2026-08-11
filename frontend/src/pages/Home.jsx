import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import ProductGridSkeleton from '../components/ProductCardSkeleton';
import SectionDivider from '../components/SectionDivider';
import Reveal from '../components/Reveal';
import ChakkiWheel from '../components/ChakkiWheel';
import GoogleReviewsWidget from '../components/GoogleReviewsWidget';
import UgcGallery from '../components/UgcGallery';
import ImpactBanner from '../components/ImpactBanner';
import StructuredData from '../components/StructuredData';
import SeoMeta from '../components/SeoMeta';
import { getProductImage } from '../utils/productImages';
import { getRecentlyViewedIds } from '../utils/recentlyViewed';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n';
import { CANONICAL_ORIGIN } from '../utils/site';
import { shouldLoadHeavyMedia, videoPosterUrl } from '../utils/connection';
import LazyVideo from '../components/LazyVideo';
import CustomerReviews from '../components/CustomerReviews';
import skincareCertificate from '../assets/skincare-workshop-certificate.jpg';

const USP_ICONS = ['🌾', '🪵', '🧪', '🚚'];

// schema.org Organization + WebSite structured data — describes the
// business entity (helps with Knowledge Panel-style recognition) and
// registers the site's search bar for Google's sitelinks search box.
const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Western Gods Organics',
  description:
    'Traditional wood-pressed cold-pressed oils, handmade herbal soaps and stone-ground herbal powders — 100% natural and chemical-free, from a family mill in Tamil Nadu, India, shipped across India and worldwide.',
  url: CANONICAL_ORIGIN,
  logo: `${CANONICAL_ORIGIN}/favicon-96x96.png`,
  image: `${CANONICAL_ORIGIN}/favicon-96x96.png`,
  telephone: '+918825875607',
  email: 'westerngodsorganic@gmail.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Shri Gopal Flour & Oil Mills, Udumalpet',
    addressLocality: 'Tiruppur District',
    addressRegion: 'Tamil Nadu',
    postalCode: '642126',
    addressCountry: 'IN',
  },
  sameAs: [
    'https://www.facebook.com/share/1T6wVtX3dC/',
    'https://www.instagram.com/westerngodsorganic',
  ],
};

const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Western Gods Organics',
  url: CANONICAL_ORIGIN,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${CANONICAL_ORIGIN}/shop?search={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export default function Home() {
  const { t, lang } = useLang();
  const { isLoggedIn, token } = useAuth();
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [current, setCurrent] = useState(0);
  const [pastOrders, setPastOrders] = useState([]);
  const timerRef = useRef(null);
  const heroVideoRefs = useRef({});

  // Whether this visit gets hero video at all. Read once on mount: the answer
  // shouldn't flip mid-scroll and start a download the visitor didn't ask for.
  const [heroVideoAllowed] = useState(shouldLoadHeavyMedia);
  // Slides that have actually been on screen. A <video> with a `src` begins
  // downloading whether or not it's the visible slide, so handing every slide
  // its source up front pulled the whole carousel — several megabytes of
  // footage, competing with the product data, for clips most visitors never
  // scroll past the first of.
  const [openedSlides, setOpenedSlides] = useState(() => new Set([0]));

  useEffect(() => {
    api.getProducts({}, token).then((d) => setProducts(d.products)).catch(() => {}).finally(() => setProductsLoading(false));
    api.getCategories().then((d) => setCategories(d.categories)).catch(() => {});
    api.getBanners().then((d) => setBanners(d.banners)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { setPastOrders([]); return; }
    api.getOrders(token).then((d) => setPastOrders(d.orders)).catch(() => {});
  }, [isLoggedIn, token]);

  // Auto-rotate hero banners. Held still on a slow connection, where each
  // rotation would mean fetching another clip the visitor didn't ask for.
  useEffect(() => {
    if (banners.length < 2 || !heroVideoAllowed) return undefined;
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % banners.length);
    }, 9000);
    return () => clearInterval(timerRef.current);
  }, [banners.length, heroVideoAllowed]);

  useEffect(() => {
    setOpenedSlides((prev) => (prev.has(current) ? prev : new Set(prev).add(current)));
  }, [current]);

  // Play the slide on screen and pause the rest. A paused <video> stops
  // pulling data, so this is what keeps an off-screen slide from quietly
  // eating the bandwidth the visible one needs.
  useEffect(() => {
    Object.entries(heroVideoRefs.current).forEach(([index, el]) => {
      if (!el) return;
      if (Number(index) === current) {
        const played = el.play();
        if (played?.catch) played.catch(() => {}); // autoplay blocked — poster stands in
      } else {
        el.pause();
      }
    });
  }, [current, banners, openedSlides]);

  const recentIds = getRecentlyViewedIds();
  const recentProducts = recentIds
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean);
  const comboProducts = products.filter((p) => p.comboItems?.length > 0);

  // "Recommended for you" — the logged-in customer's most-bought category,
  // excluding what they've already bought, so it reads as "more like this"
  // rather than re-suggesting what's already in their cupboard.
  const purchasedProductIds = new Set(pastOrders.flatMap((o) => o.items.map((it) => it.productId)));
  const categoryCounts = {};
  for (const o of pastOrders) {
    for (const it of o.items) {
      const product = products.find((p) => p.id === it.productId);
      if (product?.category) categoryCounts[product.category] = (categoryCounts[product.category] || 0) + 1;
    }
  }
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const recommendedProducts = topCategory
    ? products.filter((p) => p.category === topCategory && !purchasedProductIds.has(p.id)).slice(0, 4)
    : [];

  const activeBanner = banners[current];
  // Admin-entered banner text is shown as-is in English; translated brand copy otherwise.
  const heroTitle = lang === 'en' && activeBanner?.title ? activeBanner.title : t('heroTitle');
  const heroSub = lang === 'en' && activeBanner?.subtitle ? activeBanner.subtitle : t('heroSub');

  const stats = [
    ['8+', t('statProducts')],
    ['0%', t('statChemicals')],
    ['25°C', t('statTemp')],
    ['100%', t('statTrace')],
  ];

  return (
    <>
      <SeoMeta
        title="Western Gods Organics — Cold-Pressed Oils, Herbal Soaps & Powders"
        description="Traditional wood-pressed cold-pressed oils, handmade herbal soaps and stone-ground herbal powders — 100% natural, from Tamil Nadu, shipped worldwide."
        path="/"
      />
      <StructuredData id="ld-organization" data={ORGANIZATION_SCHEMA} />
      <StructuredData id="ld-website" data={WEBSITE_SCHEMA} />

      {/* ---------- Video hero ---------- */}
      <section className="hero-video">
        {banners.map((b, i) =>
          b.type === 'video' ? (
            <video
              key={b.id}
              ref={(el) => { heroVideoRefs.current[i] = el; }}
              className={`hero-media ${i === current ? 'visible' : ''}`}
              /* No `src` until a slide has actually been on screen, and none
                 at all on a slow connection — as long as there's a poster to
                 carry the hero in its place. Clips hosted somewhere we can't
                 derive a still from (Cloudinary, plain /uploads) still load,
                 because a blank hero would be worse than a slow one. */
              src={
                openedSlides.has(i) && (heroVideoAllowed || !videoPosterUrl(b.url))
                  ? b.url
                  : undefined
              }
              poster={videoPosterUrl(b.url) || undefined}
              muted
              loop
              playsInline
              preload="none"
            />
          ) : (
            <img
              key={b.id}
              className={`hero-media ${i === current ? 'visible' : ''}`}
              src={b.url}
              alt={b.title || 'Western Gods Organics — cold-pressed oils, herbal soaps and powders'}
            />
          )
        )}
        <div className="hero-overlay" />
        <div className="hero-video-content container">
          <span className="eyebrow light">{t('heroEyebrow')}</span>
          <h1>{heroTitle}</h1>
          <p className="lede">{heroSub}</p>
          <div className="hero-cta">
            <Link to="/shop" className="btn btn-gold">{t('shopAllOils')}</Link>
            <Link to="/bulk-enquiry" className="btn btn-outline btn-outline-light">{t('enquireBulk')}</Link>
          </div>
          <div className="hero-stats">
            {stats.map(([value, label]) => (
              <div className="stat" key={label}>
                <b>{value}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
          {banners.length > 1 && (
            <div className="hero-dots" role="tablist" aria-label="Hero banners">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  className={i === current ? 'active' : ''}
                  aria-label={`Show banner ${i + 1}`}
                  onClick={() => setCurrent(i)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- USP strip ---------- */}
      <Reveal as="section" className="usp-strip">
        <div className="container usp-grid">
          {USP_ICONS.map((icon, i) => (
            <div className="usp" key={icon}>
              <span className="usp-icon" aria-hidden="true">{icon}</span>
              <div>
                <h3>{t(`usp${i + 1}t`)}</h3>
                <p>{t(`usp${i + 1}d`)}</p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ---------- Categories ---------- */}
      <Reveal as="section" className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">{t('catEyebrow')}</span>
            <h2>{t('catTitle')}</h2>
          </div>
          <p>{t('catSub')}</p>
        </div>
        <div className="category-trio">
          {categories.map((cat) => (
            <Link key={cat.slug} to={`/shop?category=${cat.slug}`} className="category-tile">
              <img src={getProductImage(cat.image)} alt={cat.label} loading="lazy" />
              <div className="overlay" />
              <div className="label">
                <span>{t('catTag')}</span>
                <h3>{cat.label}</h3>
              </div>
            </Link>
          ))}
        </div>
      </Reveal>

      <SectionDivider />

      {/* ---------- Bestsellers ---------- */}
      <Reveal as="section" className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">{t('bestEyebrow')}</span>
            <h2>{t('bestTitle')}</h2>
          </div>
          <Link to="/shop" className="btn btn-outline btn-sm">{t('viewAll')}</Link>
        </div>
        {productsLoading ? (
          // Was previously an empty .grid — same class, zero children —
          // while the fetch was in flight, so the section popped from
          // nothing to four cards the moment data arrived. This fills that
          // same space from the first paint instead.
          <ProductGridSkeleton count={4} />
        ) : (
          <div className="grid">
            {products.slice(0, 4).map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </Reveal>

      {/* ---------- Combo offers ---------- */}
      {comboProducts.length > 0 && (
        <Reveal as="section" className="section container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Bundle & save</span>
              <h2>Combo Offers</h2>
            </div>
            <Link to="/combos" className="btn btn-outline btn-sm">{t('viewAll')}</Link>
          </div>
          <div className="grid">
            {comboProducts.slice(0, 4).map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </Reveal>
      )}

      {/* ---------- Recommended for you (logged-in, purchase-history-based) ---------- */}
      {recommendedProducts.length > 0 && (
        <Reveal as="section" className="section container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Just for you</span>
              <h2>Recommended for You</h2>
            </div>
          </div>
          <div className="grid">
            {recommendedProducts.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </Reveal>
      )}

      {/* ---------- Recently viewed ---------- */}
      {recentProducts.length > 0 && (
        <Reveal as="section" className="section container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Welcome back</span>
              <h2>Recently viewed</h2>
            </div>
          </div>
          <div className="grid">
            {recentProducts.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </Reveal>
      )}

      <SectionDivider />

      {/* ---------- Watch how it's made ---------- */}
      {banners[1] && banners[1].type === 'video' && (
        <Reveal as="section" className="section container">
          <div className="feature-split">
            <div className="feature-video">
              <LazyVideo src={banners[1].url} />
            </div>
            <div className="feature-copy">
              <span className="eyebrow">{t('watchEyebrow')}</span>
              <h2>{t('watchTitle')}</h2>
              <p className="muted">{t('watchDesc')}</p>
              <ul className="feature-list">
                <li>{t('watchLi1')}</li>
                <li>{t('watchLi2')}</li>
                <li>{t('watchLi3')}</li>
              </ul>
              <Link to="/shop" className="btn btn-forest">{t('watchCta')}</Link>
            </div>
          </div>
        </Reveal>
      )}

      {/* ---------- Process ---------- */}
      <Reveal as="section" className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">{t('processEyebrow')}</span>
            <h2>{t('processTitle')}</h2>
          </div>
        </div>
        <div className="process-steps">
          {[1, 2, 3, 4].map((n) => (
            <div className="process-step" key={n}>
              <span className="num">0{n}</span>
              <h3>{t(`step${n}t`)}</h3>
              <p className="muted">{t(`step${n}d`)}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ---------- Certification ---------- */}
      <Reveal as="section" className="section container center">
        <span className="eyebrow">Certified &amp; trained</span>
        <h2 style={{ marginBottom: 8 }}>Trained in organic skin &amp; hair care making</h2>
        <p className="muted" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
          Our soaps are handcrafted by a team formally trained in organic skin and hair care product-making.
        </p>
        <div className="certificate-frame">
          <img
            src={skincareCertificate}
            alt="Certificate of completion for the Basic Skin & Hair Care Products Making Workshop"
            loading="lazy"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div className="certificate-watermark" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i}>Western Gods Organics</span>
            ))}
          </div>
        </div>
      </Reveal>

      <SectionDivider />

      {/* ---------- Testimonials ---------- */}
      <Reveal as="section" className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">{t('testiEyebrow')}</span>
            <h2>{t('testiTitle')}</h2>
          </div>
        </div>
        {/* Real reviews, read live from what customers have written on the
            product pages. This replaced a hardcoded list of invented quotes
            with attributed names — which was both weaker than the genuine
            article and not a claim this shop should be making. */}
        <CustomerReviews limit={6} />
      </Reveal>

      <Reveal><GoogleReviewsWidget /></Reveal>

      <Reveal><ImpactBanner /></Reveal>
      <Reveal><UgcGallery /></Reveal>

      {/* ---------- Bulk CTA ---------- */}
      <Reveal as="section" className="section container center" style={{ paddingTop: 0 }}>
        <ChakkiWheel size={60} />
        <h2 style={{ marginTop: 20 }}>{t('bulkTitle')}</h2>
        <p className="muted" style={{ maxWidth: 480, margin: '0 auto 24px' }}>{t('bulkDesc')}</p>
        <Link to="/bulk-enquiry" className="btn btn-forest">{t('bulkCta')}</Link>
      </Reveal>
    </>
  );
}
