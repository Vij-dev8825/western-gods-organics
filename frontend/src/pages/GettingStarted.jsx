/**
 * A guided, one-thing-at-a-time walkthrough — distinct from How to Use This
 * Site (frontend/src/pages/HowToUse.jsx), which stays a scannable reference
 * grouped by category for a returning visitor who wants to jump straight to
 * one answer. This is for someone who'd rather be led through the whole
 * site once, in order, than scan a grid. Same real features and facts as
 * that page (nothing here is new or re-verified separately) — just told as
 * a sequence instead of a lookup table.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import SeoMeta from '../components/SeoMeta';
import ChakkiWheel from '../components/ChakkiWheel';

const STEPS = [
  {
    title: 'Tell us what you need',
    intro: 'Three ways in, depending on how much you already know.',
    items: [
      {
        icon: '✨',
        title: 'Ask "Shop with AI"',
        text: 'The ✨ bubble bottom-right answers in plain language — English, Tamil, Hindi or Malayalam, even written in English letters, like "mudi ku ennai" for hair oil.',
      },
      {
        icon: '🧭',
        title: "Not sure what you're after? Use Finder",
        text: 'A couple of questions about hair, skin or kitchen needs hands back a short, personal routine.',
        to: '/finder',
        cta: 'Open Finder',
      },
      {
        icon: '🫙',
        title: 'Already know you want an oil?',
        text: 'One or two questions, one specific oil recommended — no browsing required.',
        to: '/guide',
        cta: "Answer 2 questions",
      },
    ],
  },
  {
    title: 'Buy it your way',
    intro: "Once you've found something, it doesn't have to be a one-off purchase.",
    items: [
      {
        icon: '🔁',
        title: 'Subscribe instead of buying once',
        text: 'On any product page, choose Subscribe and pick your own delivery interval for 10% off every recurring order.',
      },
      {
        icon: '💗',
        title: "Not ready yet? Save it",
        text: "Tap the heart on any product — we'll tell you if the price drops.",
        to: '/wishlist',
        cta: 'Open Wishlist',
      },
      {
        icon: '🎁',
        title: "Buying it for someone else",
        text: 'Add a free gift note and hide the price at checkout, or send a digital gift card instead.',
        to: '/gift-cards',
        cta: 'Send a gift card',
      },
    ],
  },
  {
    title: 'See exactly what you\'re getting',
    intro: 'Not marketing copy — a real, traceable record.',
    items: [
      {
        icon: '🔍',
        title: 'Look up your bottle\'s batch',
        text: 'Every bottle carries a batch code. Type it in to see the pressing date, the farm it came from, and a photo from that day if we have one.',
      },
      {
        icon: '🗓️',
        title: 'Or book a share before it\'s even pressed',
        text: 'See what\'s scheduled at the mill and reserve bottles from that exact run, including a short video once it\'s done.',
        to: '/pressings',
        cta: "See what's pressing",
      },
    ],
  },
  {
    title: 'Get more back the longer you stay',
    intro: 'None of this costs extra — it\'s already running in the background.',
    items: [
      {
        icon: '⭐',
        title: 'Loyalty points, automatically',
        text: '1 point per ₹10 you pay, worth ₹1 each at checkout. 500 lifetime points reaches Silver, 1,500 reaches Gold — both unlock free shipping and a higher earn rate after.',
        to: '/rewards',
        cta: 'View your points',
      },
      {
        icon: '🤝',
        title: 'Bring a friend, both save ₹100',
        text: 'Your account page has a personal link — when they place their first order, you both get ₹100 off.',
        to: '/profile',
        cta: 'Get your link',
      },
      {
        icon: '♻️',
        title: 'Send bottles back for credit',
        text: 'Print a return label and get ₹20 credit for every empty glass bottle you send back.',
      },
    ],
  },
  {
    title: 'Buying more, or visiting in person',
    intro: 'For when one bottle isn\'t the plan.',
    items: [
      {
        icon: '📦',
        title: 'Ordering for a shop or event',
        text: 'Send us the quantities you need and we\'ll quote wholesale pricing.',
        to: '/bulk-enquiry',
        cta: 'Send an enquiry',
      },
      {
        icon: '📍',
        title: 'Come see the mill, or the shop',
        text: 'Get directions to both the Udumalpet mill and the Vedapatti shop.',
        to: '/store-locator',
        cta: 'Get directions',
      },
    ],
  },
  {
    title: "That's everything — keep us handy",
    intro: 'One last thing, entirely optional.',
    items: [
      {
        icon: '📲',
        title: 'Install this as an app',
        text: 'On Android or Chrome, accept the install prompt when it appears — or use the browser\'s own "Install app" option. On iPhone, use Safari\'s Share button and choose "Add to Home Screen".',
      },
    ],
  },
];

export default function GettingStarted() {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  return (
    <div className="policy-page getting-started">
      <SeoMeta
        title="Getting Started — Western Gods Organics"
        description="A guided, step-by-step walkthrough of everything this site can do for you."
        path="/getting-started"
      />
      <div className="breadcrumb">Home / Getting Started</div>
      <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
        <ChakkiWheel size={40} />
        <span className="eyebrow" style={{ margin: 0 }}>Getting started</span>
      </div>
      <h1>Let's walk through it together</h1>
      <p className="muted" style={{ maxWidth: 640, marginBottom: 8 }}>
        Six short steps, or skip straight to{' '}
        <Link to="/how-to-use">the full reference</Link> if you'd rather look something up
        yourself. Here to actually buy something?{' '}
        <Link to="/how-to-shop">The shopping &amp; checkout guide</Link> covers that specifically.
      </p>

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
