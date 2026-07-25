import { useEffect } from 'react';
import { CANONICAL_ORIGIN } from '../utils/site';

const DEFAULT_IMAGE = `${CANONICAL_ORIGIN}/favicon-96x96.png`;

function upsertMeta(attr, key, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/** Sets the per-route <title>, meta description, and Open Graph/Twitter
 * Card tags. This is a client-rendered SPA on one static index.html (see
 * index.html's own tags for the pre-JS/no-JS fallback), so — like
 * App.jsx's CanonicalTag and StructuredData — these have to be updated in
 * JS per route, or every page would share the same generic title/
 * description regardless of what it actually shows. `title` should
 * already include the brand name (callers control the exact format, e.g.
 * "Product Name | Western Gods Organics"). */
export default function SeoMeta({
  title,
  description,
  image,
  type = 'website',
  path,
  price,
  currency = 'INR',
  availability,
  robots,
}) {
  useEffect(() => {
    const url = `${CANONICAL_ORIGIN}${path ?? window.location.pathname}`;
    const img = image || DEFAULT_IMAGE;

    if (title) document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', img);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', img);
    // Open Graph's product object type — read by Facebook/Pinterest link
    // previews and shopping surfaces, separate from the schema.org Product
    // JSON-LD (StructuredData) that Google reads for rich results.
    if (type === 'product' && price != null) {
      upsertMeta('property', 'product:price:amount', String(price));
      upsertMeta('property', 'product:price:currency', currency);
    }
    if (type === 'product' && availability) {
      upsertMeta('property', 'product:availability', availability);
    }
    if (robots) upsertMeta('name', 'robots', robots);
  }, [title, description, image, type, path, price, currency, availability, robots]);

  return null;
}
