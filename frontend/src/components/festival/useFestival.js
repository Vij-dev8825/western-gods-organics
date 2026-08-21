/**
 * The festival the whole site should be dressed for, fetched once.
 *
 * Two things on every page want to know this — the home page band and the
 * announcement ticker — and asking twice for the same list on every navigation
 * is a request nobody needs. The promise is cached at module scope, so the
 * second caller gets the first one's answer.
 *
 * Deliberately not a context provider: this is read-only data that never
 * changes within a page view, and a provider would mean touching the app shell
 * to deliver something two components can simply import.
 */
import { useEffect, useState } from 'react';
import { api } from '../../api';
import { SHOW_WITHIN_DAYS, themeFor } from './registry';

let cached = null;

function loadFestivals() {
  if (!cached) {
    /* Two calls, one cache. The flower list is small, static between deploys
       and wanted by both the petals and the pookalam, so it rides along here
       rather than being fetched again by each. A failure on either side
       resolves empty — neither is worth a broken page. */
    cached = Promise.all([
      api.getFestivals().catch(() => ({})),
      api.getFlowers().catch(() => ({})),
    ])
      .then(([d, f]) => ({
        festivals: d.festivals || [],
        animation: d.animation || {},
        flowers: f.flowers || [],
      }))
      // A failure here must never be visible. Both callers treat "no festival"
      // as the ordinary state, because eleven months of the year it is.
      .catch(() => ({ festivals: [], animation: {}, flowers: [] }));
  }
  return cached;
}

/**
 * The nearest festival worth dressing for, or null.
 *
 * Same rule the band uses: the soonest one the admin has left switched on,
 * shown for the whole of its run and for the three weeks before it starts.
 * Returns the theme alongside, since every caller wants the palette.
 */
export function useNearestFestival() {
  const [state, setState] = useState({ festival: null, theme: null, animation: null, flowers: [] });

  useEffect(() => {
    let alive = true;
    loadFestivals().then(({ festivals, animation, flowers }) => {
      if (!alive) return;
      const next = festivals.find((f) => f.celebrate !== false) || null;
      const near =
        next && (next.running || (next.daysToStart ?? next.daysAway) <= SHOW_WITHIN_DAYS);
      const festival = near ? next : null;
      setState({ festival, theme: festival ? themeFor(festival) : null, animation, flowers });
    });
    return () => { alive = false; };
  }, []);

  return state;
}
