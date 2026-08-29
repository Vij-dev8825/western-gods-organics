import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import PageBanner from '../components/PageBanner';
import SeoMeta from '../components/SeoMeta';
import StructuredData from '../components/StructuredData';
import { useLang } from '../i18n';
import { buildBreadcrumbSchema } from '../utils/breadcrumbSchema';
import { CANONICAL_ORIGIN } from '../utils/site';
import { useReveal } from '../hooks/useReveal';

/** One tile, split out purely so it can hold a hook — a reveal cannot be
 *  called from inside the .map() below.
 *
 *  This uses the IntersectionObserver reveal the rest of the site already
 *  uses, rather than the CSS scroll-timeline version I reached for first.
 *  That was the right instinct and the wrong browser: Safari has no
 *  animation-timeline, so on every iPhone below 26 the tiles simply appeared,
 *  which is most of the people this page is for. An observer works
 *  everywhere back to iOS 12. */
function CategoryTile({ cat, t }) {
  const { ref, visible } = useReveal();
  return (
    <Link
      ref={ref}
      to={`/shop?category=${cat.slug}`}
      className={`category-tile card-reveal ${visible ? 'card-reveal-visible' : ''}`}
    >
      <img src={getProductImage(cat.image)} alt={cat.label} loading="lazy" />
      <div className="overlay" />
      <div className="label">
        <span>{t('catTag')}</span>
        <h3>{cat.label}</h3>
      </div>
    </Link>
  );
}

export default function Categories() {
  const { t } = useLang();
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.getCategories().then((d) => setCategories(d.categories));
  }, []);

  const itemListSchema = useMemo(() => {
    if (!categories.length) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: categories.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.label,
        url: `${CANONICAL_ORIGIN}/shop?category=${c.slug}`,
      })),
    };
  }, [categories]);

  return (
    <div className="section" style={{ paddingTop: 0 }}>
      <SeoMeta
        title="Shop by Category — Oils, Soaps & Herbal Powders | Western Gods Organics"
        description="Explore our cold-pressed oils, handmade herbal soaps and stone-ground herbal powders by category — traditional, natural, and chemical-free."
        path="/categories"
      />
      <StructuredData
        id="ld-breadcrumb"
        data={buildBreadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Categories', path: '/categories' },
        ])}
      />
      {itemListSchema && <StructuredData id="ld-itemlist" data={itemListSchema} />}
      <PageBanner page="categories" title={t('catEyebrow')} subtitle={t('catPageSub')} />
      <div className="container">
        <div className="breadcrumb">{t('navHome')} / {t('navCategories')}</div>

        <div className="category-trio">
          {categories.map((cat) => (
            <CategoryTile key={cat.slug} cat={cat} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
