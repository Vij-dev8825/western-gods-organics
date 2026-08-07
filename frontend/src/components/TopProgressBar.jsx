import { useEffect, useRef, useState } from 'react';

/** A slim bar at the very top of the viewport that fills in while a lazy
 * route's JS chunk is downloading — the same pattern YouTube, GitHub and
 * Medium use (that exact idea is a small open-source library called
 * NProgress). Deliberately not a full-page block: this is what replaces the
 * old behaviour of the whole page — including the navbar — disappearing
 * behind a centered spinner on every navigation.
 *
 * Always mounted, but renders nothing until a route-load-start event fires,
 * so it's never itself part of what a route's Suspense boundary is waiting
 * on. See utils/routeProgress.js for the event contract. */
export default function TopProgressBar() {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const trickleRef = useRef(null);

  useEffect(() => {
    function onStart() {
      clearInterval(trickleRef.current);
      setVisible(true);
      setWidth(15);
      // Eases toward ~85% and deliberately never reaches 100% on its own —
      // it should always read as "still waiting", never falsely claim
      // completion while the chunk is still in flight.
      trickleRef.current = setInterval(() => {
        setWidth((w) => (w < 85 ? w + (85 - w) * 0.12 : w));
      }, 180);
    }
    function onEnd() {
      clearInterval(trickleRef.current);
      setWidth(100);
      // Hold at 100% just long enough to read as "done", then fade rather
      // than snapping away — an instant disappearance at 100% reads as a
      // glitch, not a completion.
      setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 220);
    }
    window.addEventListener('route-load-start', onStart);
    window.addEventListener('route-load-end', onEnd);
    return () => {
      window.removeEventListener('route-load-start', onStart);
      window.removeEventListener('route-load-end', onEnd);
      clearInterval(trickleRef.current);
    };
  }, []);

  if (!visible) return null;
  return <div className="route-progress-bar" style={{ width: `${width}%` }} aria-hidden="true" />;
}
