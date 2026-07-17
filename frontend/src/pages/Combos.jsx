import { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard';
import ChakkiWheel from '../components/ChakkiWheel';
import { api } from '../api';

export default function Combos() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getProducts({ combo: true })
      .then((d) => setProducts(d.products))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container section">
      <div className="breadcrumb">Home / Combo Offers</div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Bundle & save</span>
          <h2>Combo Offers</h2>
          <p className="muted">Hand-picked bundles of our oils, soaps and powders at a better price together.</p>
        </div>
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
          <h3>No combos right now</h3>
          <p className="muted">Check back soon — we're putting together some great bundles.</p>
        </div>
      )}
    </div>
  );
}
