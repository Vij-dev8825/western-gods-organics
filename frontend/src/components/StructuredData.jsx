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
    // Some blocks are also written into index.html, so that a crawler reading
    // the raw HTML sees them without executing anything. Those we update in
    // place and must leave behind on unmount: removing one would strip the
    // page's own markup the first time a visitor navigated away from the
    // route that happened to match it, and it would not come back without a
    // reload. Only tags this component created are ours to clean up.
    const ours = !script;
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
    return ours ? () => script?.remove() : undefined;
  }, [id, data]);

  return null;
}
