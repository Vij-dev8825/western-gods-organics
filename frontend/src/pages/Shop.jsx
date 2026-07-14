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
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const category = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || '';
  const search = searchParams.get('search') || '';
  const activeFilterCount = (category !== 'all' ? 1 : 0) + (sort ? 1 : 0);

  useEffect(() => {
    api.getCategories().then((d) => setCategories(d.categories));
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
          <h2>{heading}</h2>
        </div>
        <input
          className="select shop-search"
          placeholder={t('searchPlaceholder')}
          defaultValue={search}
          onKeyDown={(e) => {
            if (e.key === 'Enter') updateParam('search', e.target.value);
          }}
        />
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
          <h4>{t('categoryFilter')}</h4>
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
              </label>
            ))}
          </div>

          <h4>{t('sortBy')}</h4>
          <div className="filter-group">
            {[
              ['', t('sortRecommended')],
              ['price-asc', t('sortPriceAsc')],
              ['price-desc', t('sortPriceDesc')],
              ['rating', t('sortRating')],
            ].map(([value, label]) => (
              <label className="filter-option" key={value || 'default'}>
                <input
                  type="radio"
                  name="sort"
                  checked={sort === value}
                  onChange={() => updateParam('sort', value)}
                />
                <span className="filter-radio" aria-hidden="true" />
                {label}
              </label>
            ))}
          </div>

          <button type="button" className="btn btn-gold btn-sm btn-block filter-apply" onClick={() => setFiltersOpen(false)}>
            Show {products.length} {t('productsCount')}
          </button>
        </aside>

        <div>
          <div className="sort-bar">
            <span className="muted">{products.length} {t('productsCount')}</span>
          </div>

          {loading ? (
            <div className="center" style={{ padding: '80px 0' }}>
              <ChakkiWheel size={50} />
            </div>
          ) : products.length ? (
            <div className="grid">
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
