import { useEffect, useState } from 'react';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';

const SESSION_KEY = 'yo_promo_popup_seen';
const RIBBON_DISMISSED_KEY = 'yo_promo_ribbon_dismissed';

/** Homepage promo popup advertising whichever coupon an admin has marked
 * "featured". Auto-opens once per browser session; after it's closed, a
 * small ribbon tab stays stuck to the screen edge so the offer isn't lost —
 * clicking it reopens the popup. */
export default function PromoPopup() {
  const [coupon, setCoupon] = useState(null);
  const [visible, setVisible] = useState(false);
  const [ribbonDismissed, setRibbonDismissed] = useState(() => !!sessionStorage.getItem(RIBBON_DISMISSED_KEY));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .getFeaturedCoupon()
      .then((d) => {
        if (!d.coupon) return;
        setCoupon(d.coupon);
        if (!sessionStorage.getItem(SESSION_KEY)) {
          setVisible(true);
          sessionStorage.setItem(SESSION_KEY, '1');
        }
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    setVisible(false);
  }

  function dismissRibbon(e) {
    e.stopPropagation();
    setRibbonDismissed(true);
    sessionStorage.setItem(RIBBON_DISMISSED_KEY, '1');
  }

  function copyCode() {
    navigator.clipboard?.writeText(coupon.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!coupon) return null;

  if (!visible) {
    if (ribbonDismissed) return null;
    const offLabel = coupon.type === 'flat' ? `₹${coupon.value} OFF` : `${coupon.value}% OFF`;
    return (
      <div className="promo-ribbon">
        <button className="promo-ribbon-open" onClick={() => setVisible(true)} type="button">
          Get {offLabel}
        </button>
        <button className="promo-ribbon-close" onClick={dismissRibbon} type="button" aria-label="Dismiss offer">
          ×
        </button>
      </div>
    );
  }

  const offer =
    coupon.type === 'flat' ? `₹${coupon.value} off` : `${coupon.value}% off`;
  const headline = coupon.promoHeadline || `Get ${offer} your order`;
  const subtext =
    coupon.promoSubtext ||
    `Use the code below at checkout${coupon.minOrder ? ` on orders above ₹${coupon.minOrder}` : ''}.`;

  return (
    <div className="promo-popup-overlay" role="dialog" aria-modal="true" aria-label="Special offer">
      <div className={`promo-popup-card ${coupon.promoImage ? 'has-image' : ''}`}>
        <button className="promo-popup-close" aria-label="Close" onClick={dismiss}>×</button>

        <div className="promo-popup-text">
          <span className="promo-popup-badge">🌿 Special offer</span>
          <h3>{headline}</h3>
          <p className="muted">{subtext}</p>
          <button className="promo-popup-code" onClick={copyCode} type="button">
            {coupon.code}
            <span className="promo-popup-copy-hint">{copied ? 'Copied!' : 'Tap to copy'}</span>
          </button>
          <button className="btn btn-outline btn-sm" onClick={dismiss} style={{ marginTop: 16 }}>
            No thanks
          </button>
        </div>

        {coupon.promoImage && (
          <div className="promo-popup-image">
            <img src={getProductImage(coupon.promoImage)} alt="" />
          </div>
        )}
      </div>
    </div>
  );
}
