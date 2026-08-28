import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Per-session gate — stops it popping again on every navigation within the
// same visit. Separate from the lifetime cap below: a manual click sets
// this too (no point auto-popping right after someone opened it themselves)
// but never counts against the cap, since that's meant to throttle
// unprompted interruptions, not deliberate engagement.
const SEEN_THIS_SESSION_KEY = 'yo_guide_tour_seen';
// Lifetime cap on unprompted auto-opens specifically, persisted in
// localStorage (unlike the session key above) so it holds across visits —
// a returning visitor who's already seen this 3 times shouldn't keep
// getting interrupted by it, though the button stays available regardless.
const AUTO_SHOW_COUNT_KEY = 'yo_guide_tour_auto_shown_count';
const MAX_AUTO_SHOWS = 3;
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
 * Auto-opens on the Home page only, up to 3 times ever, after a short delay;
 * beyond that (or on any other page) it's still reachable from its own
 * floating button — closing it hides the panel, it doesn't remove the
 * button, same as the chat/AI widgets. */
export default function GuideTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const location = useLocation();
  const hidden = location.pathname.startsWith('/admin') || location.pathname === '/login';
  const isHome = location.pathname === '/';

  useEffect(() => {
    if (hidden || !isHome) return undefined;
    let seenThisSession = false;
    let autoShowCount = 0;
    try {
      seenThisSession = sessionStorage.getItem(SEEN_THIS_SESSION_KEY) === '1';
      autoShowCount = Number(localStorage.getItem(AUTO_SHOW_COUNT_KEY)) || 0;
    } catch {
      /* private mode — skip auto-open, the button still works */
    }
    if (seenThisSession || autoShowCount >= MAX_AUTO_SHOWS) return undefined;

    const timer = setTimeout(() => {
      setOpen(true);
      try {
        sessionStorage.setItem(SEEN_THIS_SESSION_KEY, '1');
        localStorage.setItem(AUTO_SHOW_COUNT_KEY, String(autoShowCount + 1));
      } catch {
        /* nothing to persist to; harmless */
      }
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [hidden, isHome]);

  if (hidden) return null;

  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  function handleFabClick() {
    // Deliberate engagement — stop the session's auto-open from also firing
    // later, but don't touch the lifetime auto-show count above.
    try {
      sessionStorage.setItem(SEEN_THIS_SESSION_KEY, '1');
    } catch {
      /* nothing to persist to; harmless */
    }
    setOpen((o) => !o);
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
        onClick={handleFabClick}
      >
        {!open && <span className="fab-label">Quick guide</span>}
        {open ? '✕' : '🧭'}
      </button>
    </>
  );
}
