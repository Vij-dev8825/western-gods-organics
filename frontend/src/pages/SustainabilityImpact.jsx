import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

function formatGlassWeight(grams) {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${grams} g`;
}

export default function SustainabilityImpact() {
  const [impact, setImpact] = useState(null);

  useEffect(() => {
    api.getImpact().then(setImpact).catch(() => {});
  }, []);

  return (
    <div className="policy-page">
      <div className="breadcrumb">Home / Our Impact</div>
      <span className="eyebrow">Sustainability</span>
      <h1>Bottles Reused, Not Wasted</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Every glass bottle you send back for a refill credit gets cleaned, refilled, and put back into
        circulation instead of the landfill. These are real, running totals — not an estimate — pulled
        straight from bottle returns our team has actually received and confirmed.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          margin: '28px 0',
        }}
      >
        <div style={{ background: 'var(--cream-deep)', borderRadius: 'var(--radius-md)', padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--forest-deep)' }}>
            {impact ? impact.totalBottles : '—'}
          </div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>Bottles returned for reuse</div>
        </div>
        <div style={{ background: 'var(--cream-deep)', borderRadius: 'var(--radius-md)', padding: '24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--forest-deep)' }}>
            {impact ? formatGlassWeight(impact.totalGlassDivertedGrams) : '—'}
          </div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>Glass diverted from landfill</div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: '0.8rem' }}>
        Glass weight is a conservative estimate (~{impact?.gramsPerBottleEstimate ?? 150}g/bottle average), not a
        precision measurement — the bottle count itself is exact.
      </p>

      <h2>How it works</h2>
      <ul>
        <li>Order any of our cold-pressed oils — they ship in reusable glass bottles.</li>
        <li>Once your order is delivered, request a bottle return from "My Orders" and send the empties back.</li>
        <li>We confirm receipt and issue a ₹20-per-bottle refill credit coupon, redeemable on your next order.</li>
      </ul>

      <p>
        <Link to="/orders" className="btn btn-gold">Return a bottle from my orders</Link>
      </p>
    </div>
  );
}
