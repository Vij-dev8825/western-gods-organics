import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import ChakkiWheel from '../components/ChakkiWheel';
import SeoMeta from '../components/SeoMeta';

export default function SellerDirectory() {
  const [sellers, setSellers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getSellerDirectory()
      .then((d) => setSellers(d.sellers))
      .catch(() => setSellers([]))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="container section">
      <SeoMeta
        title="Meet the makers | Western Gods Organics"
        description="The independent makers, pressers and small farms selling their own products on Western Gods Organics."
        path="/sellers"
      />
      <div className="breadcrumb">Home / Makers</div>
      <span className="eyebrow">Our marketplace</span>
      <h1 style={{ marginTop: 2 }}>Meet the makers</h1>
      <p className="muted" style={{ maxWidth: 620 }}>
        Alongside what we press ourselves, these independent makers and small farms sell their own products
        here. Every one of them is a real person you can read about and ask questions of.
      </p>

      {!loaded ? (
        <div className="center" style={{ padding: '80px 0' }}>
          <ChakkiWheel size={56} />
        </div>
      ) : sellers.length === 0 ? (
        <div className="empty-state">
          <ChakkiWheel size={56} spin={false} />
          <h3>No makers listed yet</h3>
          <p className="muted">We're onboarding our first sellers — check back soon.</p>
          <Link to="/shop" className="btn btn-gold">Browse the shop</Link>
        </div>
      ) : (
        <div className="maker-grid">
          {sellers.map((s) => (
            <Link key={s.id} to={`/sellers/${s.id}`} className="maker-card">
              {s.logo ? (
                <img src={getProductImage(s.logo)} alt="" className="maker-logo" />
              ) : (
                <span className="maker-logo maker-logo-blank" aria-hidden="true">
                  {s.businessName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div style={{ minWidth: 0 }}>
                <b>{s.businessName}</b>
                {s.location && <p className="muted maker-meta">📍 {s.location}</p>}
                {s.bio && <p className="muted maker-bio">{s.bio}</p>}
                <span className="pill">{s.productCount} product{s.productCount === 1 ? '' : 's'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
