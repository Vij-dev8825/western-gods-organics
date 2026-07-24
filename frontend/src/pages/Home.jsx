import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import SectionDivider from '../components/SectionDivider';
import ChakkiWheel from '../components/ChakkiWheel';
import GoogleReviewsWidget from '../components/GoogleReviewsWidget';
import StructuredData from '../components/StructuredData';
import SeoMeta from '../components/SeoMeta';
import { getProductImage } from '../utils/productImages';
import { getRecentlyViewedIds } from '../utils/recentlyViewed';
import { useLang } from '../i18n';
import { CANONICAL_ORIGIN } from '../utils/site';

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

const TESTIMONIALS = [
  {
    quote: 'The groundnut oil smells exactly like the ghani near my childhood home. My family refuses to cook with anything else now.',
    name: 'Sunita R.',
    place: 'Hyderabad',
  },
  {
    quote: 'You can taste the difference in a simple tadka. Their sesame oil is deep, nutty and honest — worth every rupee.',
    name: 'Karthik M.',
    place: 'Chennai',
  },
  {
    quote: 'We switched our restaurant to Western Gods Organics in bulk. Consistent quality, GST invoicing, on-time delivery. Zero complaints.',
    name: 'Chef Devansh',
    place: 'Delhi NCR',
  },
];

export default function Home() {
  const { t, lang } = useLang();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    api.getProducts().then((d) => setProducts(d.products)).catch(() => {});
    api.getCategories().then((d) => setCategories(d.categories)).catch(() => {});
    api.getBanners().then((d) => setBanners(d.banners)).catch(() => {});
  }, []);

  // Auto-rotate hero banners
  useEffect(() => {
    if (banners.length < 2) return undefined;
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % banners.length);
    }, 9000);
    return () => clearInterval(timerRef.current);
  }, [banners.length]);

  const recentIds = getRecentlyViewedIds();
  const recentProducts = recentIds
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean);
  const comboProducts = products.filter((p) => p.comboItems?.length > 0);

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
              className={`hero-media ${i === current ? 'visible' : ''}`}
              src={b.url}
              autoPlay
              muted
              loop
              playsInline
              preload={i === 0 ? 'auto' : 'metadata'}
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
      <section className="usp-strip">
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
      </section>

      {/* ---------- Categories ---------- */}
      <section className="section container">
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
              <img src={getProductImage(cat.image)} alt={cat.label} />
              <div className="overlay" />
              <div className="label">
                <span>{t('catTag')}</span>
                <h3>{cat.label}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* ---------- Bestsellers ---------- */}
      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">{t('bestEyebrow')}</span>
            <h2>{t('bestTitle')}</h2>
          </div>
          <Link to="/shop" className="btn btn-outline btn-sm">{t('viewAll')}</Link>
        </div>
        <div className="grid">
          {products.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* ---------- Combo offers ---------- */}
      {comboProducts.length > 0 && (
        <section className="section container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Bundle & save</span>
              <h2>Combo Offers</h2>
            </div>
            <Link to="/combos" className="btn btn-outline btn-sm">{t('viewAll')}</Link>
          </div>
          <div className="grid">
            {comboProducts.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ---------- Recently viewed ---------- */}
      {recentProducts.length > 0 && (
        <section className="section container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Welcome back</span>
              <h2>Recently viewed</h2>
            </div>
          </div>
          <div className="grid">
            {recentProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <SectionDivider />

      {/* ---------- Watch how it's made ---------- */}
      {banners[1] && banners[1].type === 'video' && (
        <section className="section container">
          <div className="feature-split">
            <div className="feature-video">
              <video src={banners[1].url} autoPlay muted loop playsInline />
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
        </section>
      )}

      {/* ---------- Process ---------- */}
      <section className="section container">
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
      </section>

      <SectionDivider />

      {/* ---------- Testimonials ---------- */}
      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow">{t('testiEyebrow')}</span>
            <h2>{t('testiTitle')}</h2>
          </div>
        </div>
        <div className="testimonial-grid">
          {TESTIMONIALS.map((tm) => (
            <figure className="testimonial" key={tm.name}>
              <div className="stars" aria-label="5 star rating">★★★★★</div>
              <blockquote>{tm.quote}</blockquote>
              <figcaption>
                <b>{tm.name}</b> · {tm.place}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <GoogleReviewsWidget />

      {/* ---------- Bulk CTA ---------- */}
      <section className="section container center" style={{ paddingTop: 0 }}>
        <ChakkiWheel size={60} />
        <h2 style={{ marginTop: 20 }}>{t('bulkTitle')}</h2>
        <p className="muted" style={{ maxWidth: 480, margin: '0 auto 24px' }}>{t('bulkDesc')}</p>
        <Link to="/bulk-enquiry" className="btn btn-forest">{t('bulkCta')}</Link>
      </section>
    </>
  );
}
