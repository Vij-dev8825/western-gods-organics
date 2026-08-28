import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const SEEN_KEY = 'yo_guide_tour_seen';
const SHOW_DELAY_MS = 4000;

const STEPS = [
  {
    icon: '✨',
    title: 'Ask our AI shopping assistant',
    text: 'The ✨ button just below answers questions about products, shipping and returns instantly — in English, Tamil, Hindi or Malayalam.',
  },
  {
    icon: '🧭',
    title: 'Find your product fast',
    text: 'Finder and the oil-buying quiz both hand back one specific recommendation instead of a browse.',
    to: '/finder',
    cta: 'Open Finder',
  },
  {
    icon: '📱',
    title: 'Buy without an account',
    text: 'Checkout as a guest with just a one-time code sent to your phone — no password to set up.',
  },
  {
    icon: '📦',
    title: 'Track everything from My Orders',
    text: 'A visual status tracker shows exactly where your order is — placed, confirmed, shipped, delivered.',
    to: '/orders',
    cta: 'View orders',
  },
  {
    icon: '📖',
    title: 'Want the full walkthrough?',
    text: 'Two complete guides cover the rest — how to shop and everything else this site can do.',
    to: '/how-to-shop',
    cta: 'See the full guides',
  },
];

/** A small, dismissible on-page tour — distinct from the full /getting-started
 * and /how-to-shop pages, which this links out to for anyone who wants more.
 * Opens once per browser session (sessionStorage, same pattern as
 * PromoPopup's yo_promo_popup_seen) after a short delay, then stays reachable
 * from its own floating button for the rest of the visit — closing it hides
 * the panel, it doesn't remove the button, same as the chat/AI widgets. */
export default function GuideTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const location = useLocation();
  const hidden = location.pathname.startsWith('/admin') || location.pathname === '/login';

  useEffect(() => {
    if (hidden) return undefined;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      /* private mode — just skip auto-open, the button is still there */
    }
    if (seen) return undefined;
    const timer = setTimeout(() => {
      setOpen(true);
      try {
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* nothing to persist to; harmless */
      }
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
    // Only ever auto-opens once per session regardless of navigation — see hidden check above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (hidden) return null;

  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  function markSeen() {
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* nothing to persist to; harmless */
    }
  }

  return (
    <>
      {open && (
        <div className="chat-panel guide-tour-panel" role="dialog" aria-label="Site guide">
          <div className="chat-head">
            <div>
              <b>🧭 Quick guide</b>
              <span>Step {step + 1} of {total}</span>
            </div>
            <button aria-label="Close guide" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="guide-tour-body">
            <div className="guide-tour-dots">
              {STEPS.map((s, i) => (
                <span key={s.title} className={`guide-tour-dot ${i === step ? 'is-current' : ''} ${i < step ? 'is-done' : ''}`} />
              ))}
            </div>
            <div key={step} className="page-fade guide-tour-step">
              <span className="guide-tour-icon" aria-hidden="true">{current.icon}</span>
              <h4>{current.title}</h4>
              <p>{current.text}</p>
              {current.to && (
                <Link to={current.to} className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>
                  {current.cta}
                </Link>
              )}
            </div>
          </div>
          <div className="guide-tour-nav">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              ← Back
            </button>
            {isLast ? (
              <button type="button" className="btn btn-gold btn-sm" onClick={() => setOpen(false)}>
                Done
              </button>
            ) : (
              <button type="button" className="btn btn-gold btn-sm" onClick={() => setStep((s) => Math.min(total - 1, s + 1))}>
                Next →
              </button>
            )}
          </div>
        </div>
      )}

      <button
        className="ai-assistant-fab guide-tour-fab"
        aria-label={open ? 'Close guide' : 'Open site guide'}
        onClick={() => {
          markSeen();
          setOpen((o) => !o);
        }}
      >
        {!open && <span className="fab-label">Quick guide</span>}
        {open ? '✕' : '🧭'}
      </button>
    </>
  );
}
