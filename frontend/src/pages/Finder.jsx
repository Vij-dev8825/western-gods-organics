import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import ChakkiWheel from '../components/ChakkiWheel';
import SeoMeta from '../components/SeoMeta';

const QUIZ_OPTIONS = [
  { key: 'cooking', icon: '🍳', label: 'Cooking oil', match: (p) => p.category === 'oils' && p.tags?.includes('cooking') },
  { key: 'haircare', icon: '💆', label: 'Hair & skin care', match: (p) => p.tags?.includes('hair-care') || p.tags?.includes('skin-care') },
  { key: 'spices', icon: '🌿', label: 'Spices & masalas', match: (p) => p.category === 'spices-masalas' },
  { key: 'honey', icon: '🍯', label: 'Honey', match: (p) => p.category === 'honey' },
  { key: 'baby', icon: '👶', label: 'Baby care', match: (p) => p.category === 'baby-kids-care' },
  { key: 'all', icon: '✨', label: 'Show me everything', match: () => true },
];

export default function Finder() {
  const [products, setProducts] = useState([]);
  const [answer, setAnswer] = useState(null);

  useEffect(() => {
    api.getProducts().then((d) => setProducts(d.products)).catch(() => {});
  }, []);

  const selected = QUIZ_OPTIONS.find((o) => o.key === answer);
  const results = selected ? products.filter(selected.match) : [];

  return (
    <div className="container section">
      <SeoMeta title="Find Your Product — Western Gods Organics" path="/finder" />
      <div className="breadcrumb">Home / Find Your Product</div>

      {!answer ? (
        <>
          <div className="section-head">
            <div>
              <span className="eyebrow">Product finder</span>
              <h2>What are you looking for today?</h2>
            </div>
          </div>
          <div className="finder-options">
            {QUIZ_OPTIONS.map((o) => (
              <button key={o.key} type="button" className="finder-option" onClick={() => setAnswer(o.key)}>
                <span className="finder-option-icon" aria-hidden="true">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="section-head">
            <div>
              <span className="eyebrow">Recommended for you</span>
              <h2>{selected.label}</h2>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setAnswer(null)}>
              ← Start over
            </button>
          </div>

          {products.length === 0 ? (
            <div className="center" style={{ padding: '60px 0' }}>
              <ChakkiWheel size={48} />
            </div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <p className="muted">No matches yet for this — check back soon, or browse everything.</p>
              <Link to="/shop" className="btn btn-gold">Browse the shop</Link>
            </div>
          ) : (
            <div className="grid">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
