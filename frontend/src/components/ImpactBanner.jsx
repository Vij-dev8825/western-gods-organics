import { useEffect, useState } from 'react';
import { api } from '../api';

function formatGlassWeight(grams) {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)}kg` : `${grams}g`;
}

// A real (not fabricated) running total from the bottle-return program —
// only renders once there's something genuine to show.
export default function ImpactBanner() {
  const [impact, setImpact] = useState(null);

  useEffect(() => {
    api.getImpact().then(setImpact).catch(() => {});
  }, []);

  if (!impact || impact.totalBottles <= 0) return null;

  return (
    <div className="container">
      <div className="impact-banner">
        ♻️ Our customers have returned <b>{impact.totalBottles}</b> bottle(s) for reuse — about{' '}
        <b>{formatGlassWeight(impact.totalGlassDivertedGrams)}</b> of glass diverted from landfill so far.
      </div>
    </div>
  );
}
