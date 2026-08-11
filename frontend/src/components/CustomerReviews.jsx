import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';

const STAR_MAX = 5;

/**
 * Real written reviews, pulled live from what customers have actually left.
 *
 * Nothing here is typed in by hand — it reads the review table directly, so it
 * stays current as new reviews arrive and can't drift out of date the way a
 * hardcoded testimonial does. Each quote links to the product it's about,
 * which is the point: social proof that also happens to be a route to buy.
 */
export default function CustomerReviews({ limit = 6 }) {
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    // Silent on failure — a homepage missing its review strip is a smaller
    // problem than a homepage showing an error where the reviews should be.
    api.getRecentReviews(limit).then((d) => setReviews(d.reviews)).catch(() => {});
  }, [limit]);

  if (!reviews.length) return null;

  return (
    <div className="customer-reviews">
      {reviews.map((r) => (
        <figure key={r.id} className="customer-review">
          <div className="customer-review-stars" aria-label={`${r.rating} out of ${STAR_MAX}`}>
            {'★'.repeat(r.rating)}
            <span className="customer-review-stars-off">{'★'.repeat(STAR_MAX - r.rating)}</span>
          </div>
          <blockquote>{r.text}</blockquote>
          <figcaption>
            <b>{r.userName}</b>
            <Link to={`/product/${r.productId}`} className="customer-review-product">
              <img src={getProductImage(r.productImage)} alt="" loading="lazy" />
              <span>on {r.productName}</span>
            </Link>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
