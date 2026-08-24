import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { getProductImage } from '../utils/productImages';

const SESSION_KEY = 'yo_promo_popup_seen';
const RIBBON_DISMISSED_KEY = 'yo_promo_ribbon_dismissed';

/** Same shape as SaleCountdown's own timeLeft — a deadline shown nowhere
 *  reads as no deadline at all, which is the difference between an offer
 *  and a fact people can put off acting on. */
function timeLeft(endDate) {
  const diff = Math.max(0, new Date(endDate).getTime() - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    mins: Math.floor((diff / 60000) % 60),
    over: diff <= 0,
  };
}

function CountdownLine({ endDate }) {
  const [left, setLeft] = useState(() => timeLeft(endDate));
  useEffect(() => {
    const id = setInterval(() => setLeft(timeLeft(endDate)), 30000);
    return () => clearInterval(id);
  }, [endDate]);
  if (left.over) return null;
  const parts = [];
  if (left.days) parts.push(`${left.days}d`);
  if (left.days || left.hours) parts.push(`${left.hours}h`);
  parts.push(`${left.mins}m`);
  return <span className="promo-countdown">⏰ Ends in {parts.join(' ')}</span>;
}

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
          {/* The ribbon is what actually stays on screen after the popup is
              closed — a deadline that only shows once, in a dialog most
              people dismiss in a second, is barely a deadline at all. */}
          {coupon.expiresAt && <CountdownLine endDate={coupon.expiresAt} />}
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
          {coupon.expiresAt && <CountdownLine endDate={coupon.expiresAt} />}
          <button className="promo-popup-code" onClick={copyCode} type="button">
            {coupon.code}
            <span className="promo-popup-copy-hint">{copied ? 'Copied!' : 'Tap to copy'}</span>
          </button>

          {/* Somewhere to go with the code. Copying it and then closing onto the
              homepage leaves a shopper holding a code and no next step; when an
              admin has set a destination this gives them one. Copies on the way
              through so the code is on the clipboard when they land. */}
          {coupon.promoLink && (
            <Link
              className="btn btn-gold promo-popup-cta"
              to={coupon.promoLink}
              onClick={() => { copyCode(); dismiss(); }}
            >
              {coupon.promoCta || 'Take me there'}
            </Link>
          )}

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
