/**
 * A focused walkthrough of the actual purchase process — finding a product,
 * choosing a size, checking out and paying, then tracking what you bought.
 * Distinct from Getting Started (frontend/src/pages/GettingStarted.jsx),
 * which walks through site FEATURES (the AI assistant, loyalty points,
 * subscriptions) assuming someone already knows how to buy — this assumes
 * nothing and covers the mechanics of a first purchase specifically. Same
 * step/dot/Back-Next shell as that page, same real facts as How to Use
 * This Site and What's New — nothing here is a new or separately-verified
 * claim.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import SeoMeta from '../components/SeoMeta';
import ChakkiWheel from '../components/ChakkiWheel';
import ShopBuddy from '../components/ShopBuddy';
import Confetti from '../components/Confetti';

const STEPS = [
  {
    title: 'Find what you want',
    mascotLine: "Let's find your first product!",
    intro: 'Three ways in — pick whichever suits how much you already know.',
    items: [
      {
        icon: '🛒',
        title: 'Browse by category',
        text: 'Oils, soaps, powders — or search by name from the Shop page.',
        to: '/shop',
        cta: 'Browse the shop',
      },
      {
        icon: '✨',
        title: "Not sure? Ask the AI assistant",
        text: 'Tap the ✨ bubble bottom-right and describe what you need in plain language — it recommends specific products, not just categories.',
      },
      {
        icon: '🧭',
        title: 'Or answer a couple of questions',
        text: 'The Product Finder and the oil-specific buying guide both hand back one recommendation instead of a browse.',
        to: '/finder',
        cta: 'Open Finder',
      },
    ],
  },
  {
    title: 'Pick your size',
    mascotLine: 'Which size fits you best?',
    intro: 'Every product page shows the same real numbers — no guessing.',
    items: [
      {
        icon: '⚖️',
        title: 'Compare sizes by actual value',
        text: 'Each size shows its own price and live stock count. For sizes that share a unit, work out price-per-100ml/100g yourself, or just ask the AI assistant "which size is best value?"',
      },
      {
        icon: '⭐',
        title: 'Check real reviews first',
        text: 'Star ratings, written reviews and customer photos are on every product page — not just a number.',
      },
      {
        icon: '🔍',
        title: 'Verify a batch before you buy',
        text: "If you're re-ordering something you liked, the batch code on your last bottle opens its own page — pressing date, source farm, everything.",
      },
      {
        icon: '📦',
        title: 'Check your real delivery date first',
        text: 'Enter your pincode on the product page for actual calendar dates, not a generic "3-5 days" — worked out from today, skipping weekends.',
      },
    ],
  },
  {
    title: 'Add it to your cart',
    mascotLine: 'Add it up whenever you’re ready.',
    intro: "Two ways to move forward, depending on whether you're still browsing.",
    items: [
      {
        icon: '➕',
        title: 'Add to Cart to keep browsing',
        text: 'Keeps shopping — the cart total updates in the corner as you go.',
      },
      {
        icon: '⚡',
        title: 'Buy Now to check out immediately',
        text: 'Skips straight to checkout with just that item, if you already know it\'s the only thing you want.',
      },
      {
        icon: '🔁',
        title: 'Or subscribe instead of buying once',
        text: 'Choose Subscribe on the product page for 10% off every recurring delivery, on an interval you set yourself.',
      },
    ],
  },
  {
    title: 'Check out — no account required',
    mascotLine: 'Almost there — just a phone number needed.',
    intro: 'A one-time code, not a password, and only if you want one at all.',
    items: [
      {
        icon: '📱',
        title: 'Verify by OTP, not a password',
        text: "Checking out as a guest sends a one-time code to your phone. An account is created for you automatically, ready the next time you order — there's nothing extra to set up.",
      },
      {
        icon: '📍',
        title: 'Save more than one address',
        text: 'Add addresses to a real address book and pick between them at checkout — no retyping every time.',
      },
      {
        icon: '🏭',
        title: 'Or skip delivery entirely',
        text: 'Collect your order directly from the Udumalpet mill during posted pickup hours instead of waiting for a courier.',
      },
    ],
  },
  {
    title: 'Pay however suits you',
    mascotLine: 'Pick whatever payment feels easiest.',
    intro: 'Three ways to pay, all on the same checkout screen.',
    items: [
      {
        icon: '💵',
        title: 'Cash on Delivery',
        text: 'Pay when it arrives — nothing charged upfront.',
      },
      {
        icon: '💳',
        title: 'Pay online',
        text: 'Card, UPI or wallet via Razorpay — instant confirmation, and any live prepaid discount is applied automatically at checkout.',
      },
      {
        icon: '➗',
        title: 'Or split it',
        text: 'Pay a small advance online now, the rest in cash when it\'s delivered.',
      },
    ],
  },
  {
    title: "You've ordered — here's what happens next",
    mascotLine: "You did it! Here's what happens now.",
    intro: 'Everything after checkout, in one place.',
    items: [
      {
        icon: '📦',
        title: 'Track it from My Orders',
        text: 'A visual step tracker — placed, confirmed, shipped, delivered — not just a word like "processing", plus WhatsApp updates if you\'d rather not check back.',
        to: '/orders',
        cta: 'View my orders',
      },
      {
        icon: '↩️',
        title: 'Cancel or return if you need to',
        text: 'Cancel yourself before it ships. After delivery, returns are accepted within 7 days for damaged, incorrect or quality-issue items — raised from the same Orders page.',
      },
      {
        icon: '⭐',
        title: 'You just earned loyalty points too',
        text: 'Every order earns points automatically, worth ₹1 each at checkout next time — no separate signup.',
        to: '/rewards',
        cta: 'View your points',
      },
    ],
  },
];

export default function HowToShop() {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  return (
    <div className="policy-page getting-started">
      <SeoMeta
        title="How to Shop & Buy — Western Gods Organics"
        description="A step-by-step guide to finding a product, checking out and paying on this site, for anyone shopping here for the first time."
        path="/how-to-shop"
      />
      <div className="breadcrumb">Home / How to Shop &amp; Buy</div>

      <div className="howto-hero">
        <div className="howto-hero-text">
          <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
            <ChakkiWheel size={40} />
            <span className="eyebrow" style={{ margin: 0 }}>New here?</span>
          </div>
          <h1>How to shop and buy, step by step</h1>
          <p className="muted" style={{ maxWidth: 640, marginBottom: 8 }}>
            Six steps from finding a product to it arriving. Looking for something else this
            site can do? Try{' '}
            <Link to="/getting-started">Getting Started</Link> or{' '}
            <Link to="/how-to-use">the full reference</Link> instead.
          </p>
        </div>
        <div className="howto-buddy-dock">
          <div key={step} className="howto-buddy-bubble">{current.mascotLine}</div>
          <ShopBuddy mood={isLast ? 'cheer' : 'wave'} className={isLast ? 'shop-buddy-cheer' : ''} />
        </div>
      </div>
      {isLast && <Confetti key="how-to-shop-complete" />}

      <div className="getting-started-rail" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={total}>
        {STEPS.map((s, i) => (
          <button
            type="button"
            key={s.title}
            className={`getting-started-dot ${i === step ? 'is-current' : ''} ${i < step ? 'is-done' : ''}`}
            onClick={() => setStep(i)}
            aria-label={`Step ${i + 1}: ${s.title}`}
            aria-current={i === step ? 'step' : undefined}
          />
        ))}
      </div>

      <div key={step} className="page-fade">
        <span className="eyebrow">Step {step + 1} of {total}</span>
        <h2 style={{ marginTop: 4 }}>{current.title}</h2>
        <p className="muted" style={{ marginBottom: 20 }}>{current.intro}</p>

        <div className="howto-grid">
          {current.items.map((item) => (
            <div className="howto-card" key={item.title}>
              <span className="howto-icon" aria-hidden="true">{item.icon}</span>
              <div>
                <h4>{item.title}</h4>
                <p>{item.text}</p>
                {item.to && (
                  <Link to={item.to} className="btn btn-outline btn-sm">
                    {item.cta}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-between getting-started-nav">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          ← Back
        </button>
        {isLast ? (
          <Link to="/shop" className="btn btn-gold">Start shopping</Link>
        ) : (
          <button type="button" className="btn btn-gold" onClick={() => setStep((s) => Math.min(total - 1, s + 1))}>
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
