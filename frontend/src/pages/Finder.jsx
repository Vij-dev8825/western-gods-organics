import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import ChakkiWheel from '../components/ChakkiWheel';
import SeoMeta from '../components/SeoMeta';

const QUIZ_OPTIONS = [
  { key: 'cooking', icon: '🍳', label: 'Cooking oil', match: (p) => p.category === 'oils' && p.tags?.includes('cooking') },
  { key: 'haircare', icon: '💆', label: 'Hair & skin care', deep: true },
  { key: 'spices', icon: '🌿', label: 'Spices & masalas', match: (p) => p.category === 'spices-masalas' },
  { key: 'honey', icon: '🍯', label: 'Honey', match: (p) => p.category === 'honey' },
  { key: 'baby', icon: '👶', label: 'Baby care', match: (p) => p.category === 'baby-kids-care' },
  { key: 'all', icon: '✨', label: 'Show me everything', match: () => true },
];

// The "Hair & skin care" path branches into its own short quiz instead of a
// single filter — concern/preference answers are scored (+2/+1) rather than
// used as a strict filter, so a product matching more of what you picked
// ranks higher instead of being all-or-nothing excluded.
const FOCUS_OPTIONS = [
  { key: 'hair', icon: '💇', label: 'Hair care', tags: ['hair-care'] },
  { key: 'skin', icon: '🧴', label: 'Skin care', tags: ['skin-care'] },
  { key: 'both', icon: '✨', label: 'Both', tags: ['hair-care', 'skin-care'] },
];

const HAIR_CONCERNS = [
  { key: 'hairfall', icon: '💆', label: 'Hair fall & thinning', tags: ['hair-care', 'vitamin-c', 'iron', 'amla'] },
  { key: 'dryness', icon: '💧', label: 'Dry, frizzy hair', tags: ['hair-care', 'coconut', 'castor'] },
  { key: 'dandruff', icon: '❄️', label: 'Dandruff & scalp health', tags: ['hair-care', 'neem', 'tulsi'] },
];

const SKIN_CONCERNS = [
  { key: 'acne', icon: '🌿', label: 'Acne & oily skin', tags: ['neem', 'tulsi', 'skin-care'] },
  { key: 'glow', icon: '✨', label: 'Dullness & uneven tone', tags: ['turmeric', 'sandalwood', 'ubtan'] },
  { key: 'skindryness', icon: '💧', label: 'Dry, sensitive skin', tags: ['coconut', 'skin-care'] },
];

const PREF_OPTIONS = [
  { key: 'ayurvedic', icon: '🪔', label: 'Traditional Ayurvedic ingredients', tags: ['ayurvedic', 'turmeric', 'neem', 'tulsi', 'sandalwood', 'amla'] },
  { key: 'any', icon: '🤷', label: "No preference — show me what's best", tags: [] },
];

function scoreProduct(product, { focus, concerns, pref }) {
  const tags = product.tags || [];
  let score = 0;
  concerns.forEach((tagList) => {
    if (tagList.some((t) => tags.includes(t))) score += 2;
  });
  if (pref.tags.some((t) => tags.includes(t))) score += 1;
  return score;
}

export default function Finder() {
  const [products, setProducts] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [step, setStep] = useState('focus'); // focus -> concern -> pref -> results (deep quiz only)
  const [focus, setFocus] = useState(null);
  const [concern, setConcern] = useState(null);
  const [pref, setPref] = useState(null);

  useEffect(() => {
    api.getProducts().then((d) => setProducts(d.products)).catch(() => {});
  }, []);

  function reset() {
    setAnswer(null);
    setStep('focus');
    setFocus(null);
    setConcern(null);
    setPref(null);
  }

  const selected = QUIZ_OPTIONS.find((o) => o.key === answer);
  const results = selected && !selected.deep ? products.filter(selected.match) : [];

  let routine = [];
  if (selected?.deep && pref) {
    const concernLists = [];
    if (focus) concernLists.push(focus.tags);
    if (concern) concernLists.push(concern.tags);
    const pool = products.filter((p) => focus.tags.some((t) => p.tags?.includes(t)));
    routine = pool
      .map((p) => ({ product: p, score: scoreProduct(p, { focus, concerns: concernLists, pref }) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }

  const concernOptions =
    focus?.key === 'skin' ? SKIN_CONCERNS : focus?.key === 'both' ? [...HAIR_CONCERNS, ...SKIN_CONCERNS] : HAIR_CONCERNS;
  const reasonFor = (product) => {
    const reasons = [];
    if (concern && concern.tags.some((t) => product.tags?.includes(t))) reasons.push(concern.label);
    if (pref && pref.tags.some((t) => product.tags?.includes(t))) reasons.push(pref.label);
    return reasons.length ? reasons.join(' · ') : 'A good all-round match';
  };

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
      ) : selected?.deep && step === 'focus' ? (
        <>
          <div className="section-head">
            <div>
              <span className="eyebrow">Hair & skin quiz · Step 1 of 3</span>
              <h2>What are you focusing on?</h2>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={reset}>← Start over</button>
          </div>
          <div className="finder-options">
            {FOCUS_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                className="finder-option"
                onClick={() => { setFocus(o); setStep('concern'); }}
              >
                <span className="finder-option-icon" aria-hidden="true">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : selected?.deep && step === 'concern' ? (
        <>
          <div className="section-head">
            <div>
              <span className="eyebrow">Hair & skin quiz · Step 2 of 3</span>
              <h2>What's your main concern?</h2>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setStep('focus')}>← Back</button>
          </div>
          <div className="finder-options">
            {concernOptions.map((o) => (
              <button
                key={o.key}
                type="button"
                className="finder-option"
                onClick={() => { setConcern(o); setStep('pref'); }}
              >
                <span className="finder-option-icon" aria-hidden="true">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : selected?.deep && step === 'pref' ? (
        <>
          <div className="section-head">
            <div>
              <span className="eyebrow">Hair & skin quiz · Step 3 of 3</span>
              <h2>Any ingredient preference?</h2>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setStep('concern')}>← Back</button>
          </div>
          <div className="finder-options">
            {PREF_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                className="finder-option"
                onClick={() => { setPref(o); setStep('results'); }}
              >
                <span className="finder-option-icon" aria-hidden="true">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : selected?.deep && step === 'results' ? (
        <>
          <div className="section-head">
            <div>
              <span className="eyebrow">Your personalized routine</span>
              <h2>Recommended for {concern.label.toLowerCase()}</h2>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={reset}>← Start over</button>
          </div>

          {products.length === 0 ? (
            <div className="center" style={{ padding: '60px 0' }}>
              <ChakkiWheel size={48} />
            </div>
          ) : routine.length === 0 ? (
            <div className="empty-state">
              <p className="muted">No matches yet for this combination — check back soon, or browse everything.</p>
              <Link to="/shop" className="btn btn-gold">Browse the shop</Link>
            </div>
          ) : (
            <div className="grid">
              {routine.map(({ product }) => (
                <div key={product.id}>
                  <ProductCard product={product} />
                  <p className="muted" style={{ fontSize: '0.82rem', margin: '8px 4px 0' }}>
                    ✓ {reasonFor(product)}
                  </p>
                </div>
              ))}
            </div>
          )}
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
