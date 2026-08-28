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
// a returning visitor who's already seen this 2 times shouldn't keep
// getting interrupted by it, though the button stays available regardless.
const AUTO_SHOW_COUNT_KEY = 'yo_guide_tour_auto_shown_count';
const MAX_AUTO_SHOWS = 2;
const SHOW_DELAY_MS = 4000;
// Separate from the auto-show cap above: this counts deliberate opens (the
// user clicking the button themselves), not unprompted popups. Someone who's
// opened it 3 times on their own has seen what it has to offer — retire the
// button itself rather than leaving it cluttering the corner forever.
const MANUAL_OPEN_COUNT_KEY = 'yo_guide_tour_manual_open_count';
const MAX_MANUAL_OPENS = 3;

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
 * Auto-opens on the Home page only, up to 2 times ever, after a short delay;
 * beyond that (or on any other page) it's still reachable from its own
 * floating button. Closing the panel normally just hides the panel, same as
 * the chat/AI widgets — but once someone has opened it 3 times themselves,
 * the button itself retires for good on close, not just that one panel. */
export default function GuideTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  // Initialized once from a prior visit's count — a returning user who
  // already retired this never sees the button reappear. Updated (not just
  // read) when the current session's own 3rd open is closed, so retirement
  // also takes effect without needing a fresh page load.
  const [retired, setRetired] = useState(() => {
    try {
      return Number(localStorage.getItem(MANUAL_OPEN_COUNT_KEY)) >= MAX_MANUAL_OPENS;
    } catch {
      return false;
    }
  });
  const location = useLocation();
  const hidden = location.pathname.startsWith('/admin') || location.pathname === '/login';
  const isHome = location.pathname === '/';

  useEffect(() => {
    if (hidden || retired || !isHome) return undefined;
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
  }, [hidden, retired, isHome]);

  if (hidden || retired) return null;

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
    if (open) {
      handleClose();
      return;
    }
    try {
      const count = (Number(localStorage.getItem(MANUAL_OPEN_COUNT_KEY)) || 0) + 1;
      localStorage.setItem(MANUAL_OPEN_COUNT_KEY, String(count));
    } catch {
      /* nothing to persist to; harmless */
    }
    setOpen(true);
  }

  // Shared by the fab (re-clicked while open), the panel's own ✕, and its
  // Next-button-turned-Done — checked on close, not on open, so reaching the
  // 3rd open never yanks the panel out from under someone mid-read.
  function handleClose() {
    setOpen(false);
    try {
      if (Number(localStorage.getItem(MANUAL_OPEN_COUNT_KEY)) >= MAX_MANUAL_OPENS) {
        setRetired(true);
      }
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
            <button aria-label="Close guide" onClick={handleClose}>✕</button>
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
                <Link to={current.to} className="btn btn-outline btn-sm" onClick={handleClose}>
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
              <button type="button" className="btn btn-gold btn-sm" onClick={handleClose}>
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
