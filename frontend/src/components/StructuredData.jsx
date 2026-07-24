import { useEffect } from 'react';

/** Injects/updates a <script type="application/ld+json"> tag in <head>,
 * keyed by `id` so multiple schema blocks (e.g. Organization + Product)
 * can coexist without clobbering each other. Removes itself on unmount so
 * navigating away doesn't leave stale structured data for the next page —
 * this is a client-rendered SPA on one static index.html, so this has to
 * happen in JS rather than being baked into the HTML, same reasoning as
 * App.jsx's CanonicalTag. */
export default function StructuredData({ id, data }) {
  useEffect(() => {
    if (!data) return undefined;
    let script = document.getElementById(id);
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
    return () => script?.remove();
  }, [id, data]);

  return null;
}
