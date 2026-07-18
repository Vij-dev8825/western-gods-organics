import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n';

const CONSENT_KEY = 'yo_cookie_consent';

/** Bottom cookie-notice bar, shown once until the visitor accepts. The site
 * only sets essential cookies/local storage (login, cart, wishlist) — no
 * analytics or ad tracking — so "Preferences" just explains that rather
 * than offering categories that don't exist. */
export default function CookieConsent() {
  const { t } = useLang();
  const [visible, setVisible] = useState(() => !localStorage.getItem(CONSENT_KEY));
  const [showPrefs, setShowPrefs] = useState(false);
  const barRef = useRef(null);

  // Other fixed-to-the-bottom UI (chat bubble, mobile cart CTA bar) reads
  // this custom property to shift itself above the bar instead of being
  // covered by it — measured live since the bar's height varies by
  // language/viewport (text wraps to more lines on narrow screens).
  useEffect(() => {
    document.body.classList.toggle('has-cookie-bar', visible);
    if (!visible || !barRef.current) {
      document.documentElement.style.removeProperty('--cookie-bar-height');
      return undefined;
    }
    const el = barRef.current;
    const update = () => document.documentElement.style.setProperty('--cookie-bar-height', `${el.offsetHeight}px`);
    update();
    const raf = requestAnimationFrame(update);
    // Late layout settling (web fonts swapping in, images pushing the page
    // tall enough to grow a scrollbar) can reflow the bar's own text wrap
    // after everything above has already fired — a couple of cheap re-checks
    // catch that without needing to chase down the exact cause each time.
    const timers = [setTimeout(update, 300), setTimeout(update, 1000)];
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      observer.disconnect();
      window.removeEventListener('resize', update);
      document.body.classList.remove('has-cookie-bar');
      document.documentElement.style.removeProperty('--cookie-bar-height');
    };
  }, [visible]);

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setShowPrefs(false);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      <div className="cookie-consent-bar" ref={barRef} role="dialog" aria-label="Cookie consent">
        <p className="cookie-consent-text">
          {t('cookieMessage')}{' '}
          <Link to="/policy" className="cookie-consent-link">
            {t('cookieLearnMore')}
          </Link>
        </p>
        <div className="cookie-consent-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowPrefs(true)}>
            {t('cookiePreferences')}
          </button>
          <button type="button" className="btn btn-gold btn-sm" onClick={accept}>
            {t('cookieAcceptAll')}
          </button>
        </div>
      </div>

      {showPrefs && (
        <div className="cookie-pref-overlay" role="dialog" aria-modal="true" aria-label={t('cookiePrefTitle')}>
          <div className="cookie-pref-card">
            <button className="cookie-pref-close" aria-label="Close" onClick={() => setShowPrefs(false)} type="button">
              ×
            </button>
            <h3>{t('cookiePrefTitle')}</h3>
            <div className="cookie-pref-row">
              <div>
                <div className="cookie-pref-row-title">{t('cookiePrefNecessary')}</div>
                <p className="muted">{t('cookiePrefNecessaryDesc')}</p>
              </div>
              <span className="cookie-pref-always-on">✓</span>
            </div>
            <p className="muted cookie-pref-note">{t('cookiePrefNote')}</p>
            <button type="button" className="btn btn-gold btn-sm cookie-pref-save" onClick={accept}>
              {t('cookiePrefSave')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
