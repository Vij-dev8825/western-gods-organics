import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';
import ProductCard from '../components/ProductCard';
import ChakkiWheel from '../components/ChakkiWheel';
import SeoMeta from '../components/SeoMeta';

export default function SellerStorefront() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    api.getSellerStorefront(id)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoaded(true));
  }, [id]);

  if (!loaded) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container section">
        <div className="empty-state">
          <ChakkiWheel size={56} spin={false} />
          <h3>Seller not found</h3>
          <p className="muted">This seller page isn't available.</p>
          <Link to="/shop" className="btn btn-gold">Browse the shop</Link>
        </div>
      </div>
    );
  }

  const { seller, products } = data;

  return (
    <div className="container section">
      <SeoMeta
        title={`${seller.businessName} | Western Gods Organics`}
        description={seller.bio || `Products from ${seller.businessName}, selling on Western Gods Organics.`}
        path={`/sellers/${seller.id}`}
      />
      <div className="breadcrumb">Home / Shop / {seller.businessName}</div>

      <div className="form-card" style={{ margin: '0 0 26px' }}>
        <div className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          {seller.logo && (
            <img
              src={getProductImage(seller.logo)}
              alt={seller.businessName}
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '50%' }}
            />
          )}
          <div>
            <span className="eyebrow">Seller</span>
            <h1 style={{ margin: '2px 0 4px' }}>{seller.businessName}</h1>
            {seller.location && <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>📍 {seller.location}</p>}
          </div>
        </div>
        {seller.bio && <p className="muted" style={{ marginTop: 14, marginBottom: 0, maxWidth: 640 }}>{seller.bio}</p>}
        {(seller.website || seller.instagram) && (
          <p className="flex gap-2" style={{ marginTop: 12, marginBottom: 0, fontSize: '0.85rem' }}>
            {seller.website && (
              <a href={seller.website} target="_blank" rel="noreferrer noopener nofollow">Website ↗</a>
            )}
            {seller.instagram && (
              <a
                href={`https://instagram.com/${seller.instagram.replace(/^@/, '')}`}
                target="_blank"
                rel="noreferrer noopener nofollow"
              >
                Instagram ↗
              </a>
            )}
          </p>
        )}
      </div>

      <h2 style={{ marginBottom: 14 }}>
        {products.length} product{products.length === 1 ? '' : 's'} from {seller.businessName}
      </h2>

      {products.length === 0 ? (
        <p className="muted">No listings from this seller right now.</p>
      ) : (
        <div className="grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
