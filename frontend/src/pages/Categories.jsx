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
      </div>
    </div>
  );
}
