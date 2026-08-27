/**
 * What the chat assistant can see, and whether anything is wrong with it.
 *
 * The widget used to fail with one opaque sentence — "Sorry, I'm having trouble
 * right now" — while the actual reason sat in the server console where nobody
 * was looking. This page is the answer to "why is the bot broken": it shows
 * what the assistant is reading, and if a Gemini key is still configured from
 * before, it makes a real call and prints exactly what Google says back.
 *
 * The try-it box matters as much as the diagnostics. The assistant answers from
 * the catalogue, so when a product is renamed or a price changes its answers
 * change too — being able to ask it something and see the reply is how you
 * check that without opening the storefront.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const SAMPLES = [
  'which oil is good for hair',
  'how much is coconut oil',
  'do you take cash on delivery',
  'is sesame oil in stock',
  'what offers are running',
  'mudi ku ennai',
];

export default function AdminAiAssistant() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);
  const [question, setQuestion] = useState('which oil is good for hair');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);

  const load = useCallback(() => {
    setChecking(true);
    api.admin
      .aiAssistantHealth(token)
      .then(setHealth)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setChecking(false));
  }, [token, showToast]);

  useEffect(load, [load]);

  async function ask(q) {
    const text = (q ?? question).trim();
    if (!text) return;
    setQuestion(text);
    setAsking(true);
    setAnswer(null);
    try {
      setAnswer(await api.admin.aiAssistantTry(token, text));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAsking(false);
    }
  }

  const g = health?.gemini;

  return (
    <div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Support</span>
          <h2>Chat assistant</h2>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -8, maxWidth: '66ch' }}>
        The assistant answers from your own catalogue, prices, stock, delivery and
        payment settings — on this server, with no external API and no per-message
        cost. It never invents a product or a price, and hands anything it cannot
        answer to a person.
      </p>

      {!health ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="stat-grid" style={{ marginTop: 18 }}>
            <div className="stat-card">
              <span className="stat-label">Products it can see</span>
              <b className="stat-value">{health.brain.products}</b>
            </div>
            <div className="stat-card">
              <span className="stat-label">Public offers</span>
              <b className="stat-value">{health.brain.publicOffers}</b>
            </div>
            <div className="stat-card">
              <span className="stat-label">Upcoming festivals</span>
              <b className="stat-value">{health.brain.upcomingFestivals}</b>
            </div>
            <div className="stat-card">
              <span className="stat-label">Delivery &amp; payment</span>
              <b className="stat-value" style={{ fontSize: '1rem' }}>
                {health.brain.shippingConfigured && health.brain.paymentsConfigured
                  ? 'Live'
                  : 'Check settings'}
              </b>
            </div>
          </div>

          {health.brain.products === 0 && (
            <div className="alert alert-warning" style={{ marginTop: 16 }}>
              There are no products in the catalogue, so the assistant has almost
              nothing to answer with. Add products first.
            </div>
          )}

          <h3 style={{ marginTop: 26 }}>
            Which is answering: <code>{health.assistant}</code>
          </h3>
          <div className="form-card" style={{ maxWidth: 720 }}>
            {!g?.configured ? (
              <p style={{ margin: 0 }}>{g?.note}</p>
            ) : !g.inUse && g.inUse !== undefined ? (
              <p style={{ margin: 0 }}>{g.note}</p>
            ) : (
              <>
                <p style={{ margin: '0 0 6px' }}>
                  <span className={`pill${g.ok ? '' : ' pill-warn'}`}>
                    {g.ok ? 'reachable' : `error ${g.status}`}
                  </span>{' '}
                  model <code>{g.model}</code>
                </p>
                <p className="muted" style={{ fontSize: '0.86rem', marginBottom: g.diagnosis ? 6 : 0 }}>
                  Google says: {g.detail}
                </p>
                {g.diagnosis && (
                  <p style={{ fontSize: '0.88rem', margin: 0 }}>
                    <b>What that means:</b> {g.diagnosis}
                  </p>
                )}
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: 10, marginBottom: 0 }}>
                  Even while this is broken, customers are still answered — a
                  failed Gemini call falls straight through to the shop
                  assistant below rather than to an apology.
                </p>
              </>
            )}
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10, marginBottom: 0 }}>
              Gemini is opt-in: set both <code>GEMINI_API_KEY</code> and{' '}
              <code>USE_GEMINI=1</code> to put it in front of the shop
              assistant for freer conversation. Leave either unset and the shop
              assistant answers directly, with no external call at all.
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ marginTop: 12 }}
              disabled={checking}
              onClick={load}
            >
              {checking ? 'Checking…' : 'Re-check'}
            </button>
          </div>

          {/* --- try it -------------------------------------------------- */}
          <h3 style={{ marginTop: 26 }}>Ask it something</h3>
          <div className="form-card" style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="text"
                value={question}
                placeholder="Type what a customer might ask"
                style={{ flex: '1 1 260px' }}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') ask();
                }}
              />
              <button type="button" className="btn btn-gold btn-sm" disabled={asking} onClick={() => ask()}>
                {asking ? 'Asking…' : 'Ask'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.74rem' }}
                  onClick={() => ask(s)}
                >
                  {s}
                </button>
              ))}
            </div>

            {answer && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(31,61,43,0.12)' }}>
                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{answer.reply}</p>
                <p className="muted" style={{ fontSize: '0.78rem', marginTop: 10, marginBottom: 0 }}>
                  answered in {answer.ms} ms
                  {answer.productIds.length
                    ? ` · shows ${answer.productIds.length} product card${answer.productIds.length === 1 ? '' : 's'}: ${answer.productIds.join(', ')}`
                    : ' · no product cards'}
                  {answer.unmatched ? ' · handed to a human' : ''}
                </p>
                {answer.suggestions?.length > 0 && (
                  <p className="muted" style={{ fontSize: '0.78rem', margin: '4px 0 0' }}>
                    follow-ups offered: {answer.suggestions.join(' · ')}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
