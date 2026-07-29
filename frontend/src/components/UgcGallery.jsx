import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api';

// Shoppable wall of real customer review photos, pulled from every product's
// reviews (see GET /api/products/reviews/gallery) rather than a separate
// curated collection — so it grows automatically as photo reviews come in.
export default function UgcGallery() {
  const [gallery, setGallery] = useState([]);

  useEffect(() => {
    api.getReviewGallery(16).then((d) => setGallery(d.gallery || [])).catch(() => {});
  }, []);

  if (!gallery.length) return null;

  return (
    <section className="section container">
      <div className="section-head">
        <div>
          <span className="eyebrow">From our customers</span>
          <h2>Real homes, real reviews</h2>
        </div>
      </div>
      <div className="ugc-grid">
        {gallery.map((g, i) => (
          <Link
            to={`/product/${g.productId}`}
            className="ugc-tile"
            key={`${g.reviewId}-${i}`}
            title={`${g.productName} — ${'★'.repeat(g.rating)}`}
          >
            <img src={g.image} alt={`${g.userName}'s photo of ${g.productName}`} loading="lazy" />
            <div className="ugc-tile-overlay">
              <span className="ugc-tile-stars" aria-hidden="true">{'★'.repeat(g.rating)}</span>
              <span className="ugc-tile-product">{g.productName}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
