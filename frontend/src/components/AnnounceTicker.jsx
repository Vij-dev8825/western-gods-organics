/**
 * The scrolling strip along the top of the shop.
 *
 * Replaces a single centred line, which could hold one promise and no more.
 * The shop has several worth making — free shipping across the southern
 * states, a different threshold for the rest of India, cash on delivery, that
 * everything is pressed the week it ships — and a ticker fits them all without
 * making the header taller.
 *
 * Three things it has to get right:
 *
 *  - SEAMLESS. The list is rendered twice and the track is translated by
 *    exactly half its width, so the moment the first copy leaves the frame the
 *    second is where it started. Any gap or jump is this getting out of step.
 *  - PACED. Duration comes from the measured width and a pixels-per-second
 *    rate, not a fixed number of seconds. Two messages and eight then read at
 *    the same speed instead of one crawling and the other bolting.
 *  - STOPPABLE. It pauses on hover and on keyboard focus, and under Reduce
 *    Motion it does not move at all — it becomes a strip you can scroll
 *    yourself. A perpetual horizontal crawl is one of the worst offenders for
 *    anyone with a vestibular disorder, and the copy is too important to hide.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useLang } from '../i18n';

export default function AnnounceTicker() {
  const { t } = useLang();
  const [config, setConfig] = useState(null);
  const trackRef = useRef(null);
  const [duration, setDuration] = useState(30);

  useEffect(() => {
    let alive = true;
    api
      .getAnnouncements()
      .then((d) => { if (alive) setConfig(d); })
      .catch(() => { if (alive) setConfig(null); });
    return () => { alive = false; };
  }, []);

  /* Nothing configured yet, or the API is down: fall back to the line the site
     has always shown. The top of the shop is never blank. */
  const messages =
    config?.active && config.messages?.length ? config.messages : [t('announcement')];
  const speed = config?.speed || 60;

  /* Measured after layout, and again when the text or the viewport changes —
     a wrapped line is a different width, and a duration from the old width
     would scroll at the wrong pace. */
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const measure = () => {
      // Half, because the track holds two copies of the list.
      const half = el.scrollWidth / 2;
      if (half > 0) setDuration(Math.max(8, half / speed));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [messages.join('|'), speed]);

  const items = messages.map((m, i) => (
    <span className="ticker-item" key={i}>
      {m}
    </span>
  ));

  return (
    <div className="announce-bar ticker" role="region" aria-label="Shop announcements">
      <div
        className="ticker-track"
        ref={trackRef}
        style={{ animationDuration: `${duration}s` }}
        tabIndex={0}
      >
        <div className="ticker-run">{items}</div>
        {/* The second copy is decoration — it exists so the loop has no seam.
            Hidden from screen readers so the promises are not read twice. */}
        <div className="ticker-run" aria-hidden="true">{items}</div>
      </div>
    </div>
  );
}
