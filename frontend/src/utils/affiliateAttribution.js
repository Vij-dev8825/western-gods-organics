const STORAGE_KEY = 'yo_affiliate_code';
const WINDOW_DAYS = 30;

/** Captures ?aff=CODE from the current URL into localStorage with a
 * timestamp, so an affiliate's shared link keeps crediting the eventual sale
 * even if the customer browses for a while — or leaves and comes back —
 * before actually checking out. Call once, on app mount. */
export function captureAffiliateCode() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('aff');
  if (code) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: code.toUpperCase(), capturedAt: Date.now() }));
  }
}

/** The still-valid captured code, or null if none was captured or the
 * attribution window has expired. */
export function getAttributedAffiliateCode() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { code, capturedAt } = JSON.parse(raw);
    if (!code || !capturedAt) return null;
    if (Date.now() - capturedAt > WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearAttributedAffiliateCode() {
  localStorage.removeItem(STORAGE_KEY);
}
