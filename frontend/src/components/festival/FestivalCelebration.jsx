/**
 * The festival band on the home page.
 *
 * Reads the calendar the mill already keeps, picks the nearest festival, dresses
 * itself in that festival's colours and hands the visitor its ritual gesture to
 * perform. Finish it and the season's code is revealed.
 *
 * Three things it deliberately does NOT do:
 *
 *  - It does not render when no festival is within three weeks. A home page
 *    permanently in festival dress is just a banner, and this earns its space
 *    by being occasional.
 *  - It does not invent an offer. `couponCode` comes from the festival record,
 *    and when the admin has not set one the band says the honest thing instead
 *    of implying a discount that does not exist.
 *  - It does not re-ask. Completion is remembered per festival, so someone who
 *    lit the lamps on Tuesday sees the finished porch on Wednesday rather than
 *    an empty one.
 *
 * All of the colour arrives as CSS custom properties set from the theme, so a
 * new festival needs no new stylesheet — see registry.js.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useToast } from '../../context/ToastContext';
import { SHOW_WITHIN_DAYS, themeFor } from './registry';
import '../../styles/festival.css';

const DONE_KEY = 'wg_festival_done';

/** Which festivals this browser has already finished. */
function readDone() {
  try {
    const raw = JSON.parse(localStorage.getItem(DONE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function markDone(key) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify({ ...readDone(), [key]: true }));
  } catch {
    /* Private mode. The gesture still works, it just will not be remembered. */
  }
}

const shortDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function FestivalCelebration() {
  const { showToast } = useToast();
  const [festival, setFestival] = useState(null);
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .getFestivals()
      .then((d) => {
        if (!alive) return;
        /* listUpcoming already sorts soonest-first and drops anything past, so
           the first entry is the one to celebrate. */
        const next = (d.festivals || [])[0] || null;
        setFestival(next && next.daysAway <= SHOW_WITHIN_DAYS ? next : null);
      })
      .catch(() => {
        /* The home page must not depend on this. Silence is the right failure. */
        if (alive) setFestival(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const theme = useMemo(() => themeFor(festival), [festival]);

  /* A key per festival occurrence, so next year's Onam is a fresh porch. */
  const doneKey = festival ? `${theme?.id || 'x'}:${festival.date}` : null;

  useEffect(() => {
    if (doneKey && readDone()[doneKey]) setFilled(theme.steps);
  }, [doneKey, theme]);

  const complete = !!theme && filled >= theme.steps;

  const step = useCallback(() => {
    if (!theme) return;
    setFilled((n) => {
      const next = Math.min(theme.steps, n + 1);
      if (next >= theme.steps && n < theme.steps && doneKey) markDone(doneKey);
      return next;
    });
  }, [theme, doneKey]);

  const copyCode = useCallback(() => {
    if (!festival?.couponCode) return;
    navigator.clipboard?.writeText(festival.couponCode).then(
      () => showToast(`${festival.couponCode} copied`),
      () => {}
    );
  }, [festival, showToast]);

  if (!festival || !theme) return null;

  const { Motif, palette } = theme;
  const pct = Math.round((filled / theme.steps) * 100);

  const countdown =
    festival.daysAway > 1
      ? `${festival.daysAway} days to go`
      : festival.daysAway === 1
        ? 'Tomorrow'
        : 'Today';

  return (
    <section
      className={`fest${complete ? ' is-complete' : ''}`}
      style={{
        '--f-ink': palette.ink,
        '--f-paper': palette.paper,
        '--f-paper-2': palette.paper2,
        '--f-accent': palette.accent,
        '--f-accent-d': palette.accentDeep,
        '--f-glow': palette.glow,
      }}
      aria-labelledby="fest-heading"
    >
      <div className="container fest-inner">
        <div className="fest-copy">
          <p className="fest-eyebrow">{theme.eyebrow}</p>
          <h2 id="fest-heading">{theme.greeting}</h2>
          <p className="fest-lede">{theme.lede}</p>

          <div className="fest-meta">
            <span className="fest-chip">{countdown}</span>
            {festival.orderingClosed === false && festival.orderBy && (
              <span className="fest-chip is-quiet">
                Order by {shortDate(festival.orderBy)}
              </span>
            )}
          </div>

          {!complete ? (
            <>
              <p className="fest-action">{theme.action}</p>
              <div className="fest-meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${pct}%` }} />
              </div>
            </>
          ) : (
            <div className="fest-reward">
              <p className="fest-done">{theme.doneLine}</p>
              {festival.couponCode ? (
                <>
                  <button type="button" className="fest-code" onClick={copyCode}>
                    {festival.couponCode}
                  </button>
                  <p className="fest-fine">Tap to copy — use it at checkout</p>
                </>
              ) : (
                <p className="fest-fine">
                  No {theme.label} offer is running just now, but the oils are
                  pressed the week they are sent.
                </p>
              )}
            </div>
          )}

          <div className="fest-cta">
            <Link className="btn btn-gold btn-sm" to="/shop">
              Shop the season
            </Link>
            {theme.route && (
              <Link className="btn btn-outline btn-sm" to={theme.route}>
                {theme.routeLabel}
              </Link>
            )}
            <Link className="btn btn-outline btn-sm" to="/festivals">
              Festival calendar
            </Link>
          </div>
        </div>

        <div className="fest-stage">
          <Motif steps={theme.steps} filled={filled} onStep={step} theme={theme} />
          {complete && <span className="fest-seal">{theme.label}</span>}
        </div>
      </div>
    </section>
  );
}
