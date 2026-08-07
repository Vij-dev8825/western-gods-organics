import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import ProductGridSkeleton from '../components/ProductCardSkeleton';
import { ProductChatCard } from '../components/AiAssistant';
import ChakkiWheel from '../components/ChakkiWheel';
import PageBanner from '../components/PageBanner';
import SeoMeta from '../components/SeoMeta';
import StructuredData from '../components/StructuredData';
import { useLang } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { buildBreadcrumbSchema } from '../utils/breadcrumbSchema';
import { CANONICAL_ORIGIN } from '../utils/site';

export default function Shop() {
  const { t } = useLang();
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dense, setDense] = useState(false);
  const [aiFallback, setAiFallback] = useState(null); // { reply, productIds } once a zero-result search resolves
  const [aiFallbackLoading, setAiFallbackLoading] = useState(false);
  const [aiFallbackProducts, setAiFallbackProducts] = useState([]);

  const category = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || '';
  const search = searchParams.get('search') || '';
  const price = searchParams.get('price') || '';
  const isNewOnly = searchParams.get('isNew') === 'true';
  const activeFilterCount =
    (category !== 'all' ? 1 : 0) + (sort ? 1 : 0) + (price ? 1 : 0) + (isNewOnly ? 1 : 0);

  useEffect(() => {
    api.getCategories().then((d) => {
      setCategories(d.categories);
      setTotalCount(d.totalCount ?? 0);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .getProducts({ category, sort, search, price, isNew: isNewOnly ? 'true' : '' }, token)
      .then((d) => setProducts(d.products))
      .finally(() => setLoading(false));
  }, [category, sort, search, price, isNewOnly]);

  // Reuses the existing Gemini-backed shopping assistant instead of leaving
  // a dead "no results" state — Mamaearth's own search (researched worldwide
  // comparison) does exactly that: a bare "0 results" with no recovery path.
  useEffect(() => {
    if (loading || products.length > 0 || !search.trim()) {
      setAiFallback(null);
      return undefined;
    }
    let cancelled = false;
    setAiFallbackLoading(true);
    api
      .askAiAssistant(
        `A customer searched "${search.trim()}" on the Shop page and got zero results. Suggest up to 4 products from the catalog that might be what they meant or a close alternative, with a brief one-sentence reason.`,
        []
      )
      .then((d) => { if (!cancelled) setAiFallback(d); })
      .catch(() => { if (!cancelled) setAiFallback(null); })
      .finally(() => { if (!cancelled) setAiFallbackLoading(false); });
    return () => { cancelled = true; };
  }, [loading, products.length, search]);

  useEffect(() => {
    if (!aiFallback?.productIds?.length) {
      setAiFallbackProducts([]);
      return undefined;
    }
    let cancelled = false;
    Promise.all(
      aiFallback.productIds.map((id) => api.getProduct(id, token).then((d) => d.product).catch(() => null))
    ).then((list) => { if (!cancelled) setAiFallbackProducts(list.filter(Boolean)); });
    return () => { cancelled = true; };
  }, [aiFallback, token]);

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  const heading = useMemo(() => {
    if (category === 'all') return t('allProducts');
    const found = categories.find((c) => c.slug === category);
    return found ? found.label : t('allProducts');
  }, [category, categories, t]);

  // Written per-category in Admin -> Categories. This is the difference
  // between the page being a bare product grid and having a genuine chance
  // of ranking for its own search term — see Keerai Kadai's own
  // /collections/dip-soup page for what a category page that actually
  // competes looks like.
  const categoryDescription = useMemo(() => {
    if (category === 'all') return '';
    return categories.find((c) => c.slug === category)?.description || '';
  }, [category, categories]);

  // Lets Google understand this page lists specific products, not just text —
  // only meaningful with an explicit crawl order, so it's skipped whenever a
  // sort/search/filter has scrambled the "recommended" order into something
  // that wouldn't reproduce for the next crawl.
  const itemListSchema = useMemo(() => {
    if (!products.length || sort || search || price || isNewOnly) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${CANONICAL_ORIGIN}/product/${p.id}`,
      })),
    };
  }, [products, sort, search, price, isNewOnly]);

  const breadcrumbSchema = useMemo(
    () =>
      buildBreadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Shop', path: '/shop' },
        ...(category !== 'all' ? [{ name: heading, path: `/shop?category=${category}` }] : []),
      ]),
    [category, heading]
  );

  return (
    <div className="section" style={{ paddingTop: 0 }}>
      <SeoMeta
        title={category === 'all' ? 'Shop All Products | Western Gods Organics' : `${heading} | Western Gods Organics`}
        description={
          (categoryDescription || 'Browse our cold-pressed oils, handmade herbal soaps and stone-ground herbal powders — 100% natural, shipped across India and worldwide.').slice(0, 160)
        }
        path={category === 'all' ? '/shop' : `/shop?category=${category}`}
      />
      <StructuredData id="ld-breadcrumb" data={breadcrumbSchema} />
      {itemListSchema && <StructuredData id="ld-itemlist" data={itemListSchema} />}
      <PageBanner page="shop" title={t('shopTitle')} subtitle={t('shopBannerSub')} />
      <div className="container">
      <div className="breadcrumb">{t('navHome')} / {t('shopTitle')} {category !== 'all' && `/ ${heading}`}</div>
      <div className="section-head">
        <div>
          <span className="eyebrow">{t('shopTitle')}</span>
          <h2>{search ? `${t('searchResultsFor')} "${search}"` : heading}</h2>
          {!search && categoryDescription && (
            <p className="muted" style={{ maxWidth: 640, marginTop: 6 }}>{categoryDescription}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        className={`filter-toggle ${filtersOpen ? 'open' : ''}`}
        onClick={() => setFiltersOpen((o) => !o)}
      >
        <span>
          Filters{activeFilterCount > 0 && <span className="filter-toggle-count">{activeFilterCount}</span>}
        </span>
        <span className="filter-toggle-chevron">▾</span>
      </button>

      <div className="shop-layout">
        <aside className={`filter-panel ${filtersOpen ? 'open' : ''}`}>
          <details className="filter-accordion" open>
            <summary>{t('categoryFilter')}</summary>
            <div className="filter-group">
              <label className="filter-option">
                <input
                  type="radio"
                  name="category"
                  checked={category === 'all'}
                  onChange={() => updateParam('category', '')}
                />
                <span className="filter-radio" aria-hidden="true" />
                {t('allProducts')}
                <span className="filter-option-count">({totalCount})</span>
              </label>
              {categories.map((c) => (
                <label className="filter-option" key={c.slug}>
                  <input
                    type="radio"
                    name="category"
                    checked={category === c.slug}
                    onChange={() => updateParam('category', c.slug)}
                  />
                  <span className="filter-radio" aria-hidden="true" />
                  {c.label}
                  <span className="filter-option-count">({c.count})</span>
                </label>
              ))}
            </div>
          </details>

          <details className="filter-accordion" open>
            <summary>{t('priceFilter')}</summary>
            <div className="filter-group">
              <label className="filter-option">
                <input type="radio" name="price" checked={price === ''} onChange={() => updateParam('price', '')} />
                <span className="filter-radio" aria-hidden="true" />
                {t('allProducts')}
              </label>
              {[
                ['under200', t('priceUnder200')],
                ['200to400', t('price200to400')],
                ['400to600', t('price400to600')],
                ['above600', t('priceAbove600')],
              ].map(([value, label]) => (
                <label className="filter-option" key={value}>
                  <input
                    type="radio"
                    name="price"
                    checked={price === value}
                    onChange={() => updateParam('price', value)}
                  />
                  <span className="filter-radio" aria-hidden="true" />
                  {label}
                </label>
              ))}
            </div>
          </details>

          <details className="filter-accordion" open>
            <summary>{t('newArrivalFilter')}</summary>
            <div className="filter-group">
              <label className="filter-option">
                <input
                  type="checkbox"
                  checked={isNewOnly}
                  onChange={(e) => updateParam('isNew', e.target.checked ? 'true' : '')}
                />
                <span className="filter-radio filter-checkbox" aria-hidden="true" />
                {t('newArrivalOnly')}
              </label>
            </div>
          </details>

          <button type="button" className="btn btn-gold btn-sm btn-block filter-apply" onClick={() => setFiltersOpen(false)}>
            Show {products.length} {t('productsCount')}
          </button>
        </aside>

        <div>
          <div className="sort-bar">
            <span className="muted">{products.length} {t('productsCount')}</span>
            <div className="sort-bar-controls">
              <div className="grid-toggle" role="group" aria-label="Grid density">
                <button
                  type="button"
                  className={!dense ? 'active' : ''}
                  aria-label="Comfortable grid"
                  aria-pressed={!dense}
                  onClick={() => setDense(false)}
                >
                  <span />
                  <span />
                </button>
                <button
                  type="button"
                  className={dense ? 'active' : ''}
                  aria-label="Compact grid"
                  aria-pressed={dense}
                  onClick={() => setDense(true)}
                >
                  <span />
                  <span />
                  <span />
                  <span />
                </button>
              </div>
              <label className="sort-select-wrap">
                <span className="sort-select-label">{t('sortBy')}</span>
                <select
                  className="select sort-select"
                  value={sort}
                  onChange={(e) => updateParam('sort', e.target.value)}
                  aria-label={t('sortBy')}
                >
                  <option value="">{t('sortRecommended')}</option>
                  <option value="price-asc">{t('sortPriceAsc')}</option>
                  <option value="price-desc">{t('sortPriceDesc')}</option>
                  <option value="rating">{t('sortRating')}</option>
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            // A layout-matching placeholder reads as faster than a spinner
            // at the same load time, and — unlike the old full-page
            // ChakkiWheel here — it shows the shape of what's coming instead
            // of blanking the whole product area.
            <ProductGridSkeleton count={dense ? 12 : 8} dense={dense} />
          ) : products.length ? (
            <div className={`grid ${dense ? 'grid-compact' : ''}`}>
              {products.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <ChakkiWheel size={56} spin={false} />
              <h3>{t('noMatch')}</h3>
              <p className="muted">{t('noMatchSub')}</p>
              {search.trim() && (
                <div className="ai-no-results">
                  {aiFallbackLoading && <p className="muted">✨ Checking if we have something close…</p>}
                  {!aiFallbackLoading && aiFallback?.reply && (
                    <>
                      <p className="ai-no-results-msg">✨ {aiFallback.reply}</p>
                      {aiFallbackProducts.length > 0 && (
                        <div className="ai-product-cards">
                          {aiFallbackProducts.map((p) => (
                            <ProductChatCard key={p.id} product={p} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
