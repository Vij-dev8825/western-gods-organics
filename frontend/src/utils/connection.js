/**
 * What the browser knows about the network it's on.
 *
 * Used to decide whether the site is allowed to spend megabytes on decoration.
 * Autoplaying hero footage is a nice touch on office wifi and actively hostile
 * on a 2G connection or a metered prepaid pack, where those same bytes push
 * the product listing — the thing the visitor actually came for — back by
 * tens of seconds.
 *
 * The Network Information API isn't available everywhere (Safari and Firefox
 * don't ship it), so every helper here has to answer sensibly when it's
 * missing. "Unknown" is treated as "fine": guessing slow on a fast connection
 * would strip the site's video for most desktop visitors.
 */

function connectionInfo() {
  if (typeof navigator === 'undefined') return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

/** True when the visitor has explicitly asked browsers to use less data.
 * This one is a stated preference, not a measurement — always honour it. */
export function prefersReducedData() {
  return connectionInfo()?.saveData === true;
}

/** True on connections where a megabyte is a real cost in seconds. 3G is
 * included deliberately: at a typical ~700kbps it takes well over a minute to
 * pull the homepage's hero clips, which is long enough that most visitors
 * leave first. */
export function isSlowConnection() {
  const c = connectionInfo();
  if (!c) return false;
  if (c.saveData) return true;
  return ['slow-2g', '2g', '3g'].includes(c.effectiveType);
}

/** Whether this visit should download decorative video at all. Combines the
 * network check with the accessibility preference, since someone who has
 * turned off motion doesn't want autoplaying footage either way. */
export function shouldLoadHeavyMedia() {
  if (isSlowConnection() || prefersReducedData()) return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  }
  return true;
}

/** The still-frame URL for a stored video (see backend/routes/media.js).
 * Returns null for anything that isn't one of our own /api/media clips —
 * Cloudinary and /uploads URLs have no poster endpoint. */
export function videoPosterUrl(url) {
  if (!url) return null;
  const match = /^\/api\/media\/([^/?#]+)$/.exec(url);
  return match ? `/api/media/${match[1]}/poster` : null;
}
