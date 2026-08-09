import { useEffect, useRef, useState } from 'react';
import { shouldLoadHeavyMedia, videoPosterUrl } from '../utils/connection';

/** How early to start fetching, in viewport heights. Far enough ahead that the
 * clip is usually playing by the time it's scrolled to, close enough that a
 * visitor who never reaches it never pays for it. */
const PREFETCH_MARGIN = '200px';

/**
 * A muted decorative video that costs nothing until it's nearly on screen.
 *
 * A plain <video src> downloads immediately wherever it sits in the document,
 * so a clip halfway down the page competes with the content above it for
 * bandwidth — worst exactly when bandwidth is scarce. This holds the source
 * back until an IntersectionObserver says the element is close, and on a slow
 * or data-saving connection never loads it at all, showing the poster instead.
 */
export default function LazyVideo({ src, className = '', poster }) {
  const ref = useRef(null);
  const [active, setActive] = useState(false);
  const posterSrc = poster || videoPosterUrl(src) || undefined;

  useEffect(() => {
    // Skipping the clip on a slow connection only helps if a still can take
    // its place; with no poster to fall back on it would just leave a hole.
    if (!shouldLoadHeavyMedia() && posterSrc) return undefined;
    const el = ref.current;
    // No IntersectionObserver (old Safari) — load it rather than leave a
    // permanently blank frame; the poster still carries the first paint.
    if (!el || typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: PREFETCH_MARGIN }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src, posterSrc]);

  return (
    <video
      ref={ref}
      className={className}
      src={active ? src : undefined}
      poster={posterSrc}
      autoPlay={active}
      muted
      loop
      playsInline
      preload="none"
    />
  );
}
