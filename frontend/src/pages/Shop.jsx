import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import ChakkiWheel from '../components/ChakkiWheel';
import { useLang } from '../i18n';

export default function Shop() {
  const { t } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dense, setDense] = useState(false);

  const category = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || '';
  const search = searchParams.get('search') || '';
  const activeFilterCount = (category !== 'all' ? 1 : 0) + (sort ? 1 : 0);

  useEffect(() => {
    api.getCategories().then((d) => {
      setCategories(d.categories);
      setTotalCount(d.totalCount ?? 0);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .getProducts({ category, sort, search })
      .then((d) => setProducts(d.products))
      .finally(() => setLoading(false));
  }, [category, sort, search]);

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

  return (
    <div className="container section">
      <div className="breadcrumb">{t('navHome')} / {t('shopTitle')} {category !== 'all' && `/ ${heading}`}</div>
      <div className="section-head">
        <div>
          <span className="eyebrow">{t('shopTitle')}</span>
          <h2>{search ? `${t('searchResultsFor')} "${search}"` : heading}</h2>
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
            <div className="center" style={{ padding: '80px 0' }}>
              <ChakkiWheel size={50} />
            </div>
          ) : products.length ? (
            <div className={`grid ${dense ? 'grid-compact' : ''}`}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <ChakkiWheel size={56} spin={false} />
              <h3>{t('noMatch')}</h3>
              <p className="muted">{t('noMatchSub')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
