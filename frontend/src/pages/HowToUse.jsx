/**
 * A practical "how do I actually do that" reference for the site itself —
 * distinct from What's New, which announces that a feature exists. Every
 * instruction here describes a real, already-built feature; numbers (point
 * rates, tier thresholds, referral amount) are read from the same source
 * the feature itself uses, not restated from memory.
 */
import { Link } from 'react-router-dom';
import SeoMeta from '../components/SeoMeta';
import Reveal from '../components/Reveal';
import ChakkiWheel from '../components/ChakkiWheel';

const GROUPS = [
  {
    eyebrow: 'Find what you need',
    items: [
      {
        icon: '✨',
        title: 'Ask "Shop with AI"',
        text: 'Tap the ✨ bubble in the bottom-right corner and ask in plain language — "what\'s good for dry skin", "do you ship to the US". It understands Tamil, Hindi and Malayalam written in English letters too, like "mudi ku ennai" for hair oil.',
      },
      {
        icon: '🧭',
        title: 'Use the Product Finder',
        text: 'Tell it what you\'re shopping for — hair, skin or kitchen — and for hair or skin care, a couple more questions get you a short, personal routine.',
        to: '/finder',
        cta: 'Open Finder',
      },
      {
        icon: '🫙',
        title: '"Which Oil Should I Buy?"',
        text: 'A shorter, oil-only version of the same idea — one or two questions, one specific oil recommended.',
        to: '/guide',
        cta: 'Answer 2 questions',
      },
      {
        icon: '🔍',
        title: 'Look up your batch',
        text: 'Every bottle carries a batch code. Type it in to see exactly when it was pressed, which farm it came from, and a photo from that day if we have one.',
      },
    ],
  },
  {
    eyebrow: 'Buy your way',
    items: [
      {
        icon: '🔁',
        title: 'Set up Subscribe & Save',
        text: 'On any product page, choose Subscribe instead of a one-off buy — pick a preset delivery interval, or set your own number of days, for 10% off every recurring order.',
      },
      {
        icon: '💗',
        title: 'Save it to your Wishlist',
        text: 'Tap the heart on any product. We\'ll tell you if the price drops on something you\'ve saved.',
        to: '/wishlist',
        cta: 'Open Wishlist',
      },
      {
        icon: '🎁',
        title: 'Sending it as a gift',
        text: 'At checkout, add a free gift note and hide the price on the packing slip — or send a digital gift card in any amount instead.',
        to: '/gift-cards',
        cta: 'Send a gift card',
      },
      {
        icon: '🌐',
        title: 'Change currency or language',
        text: 'Two dropdowns at the bottom of every page switch how prices are shown and which language the site reads in.',
      },
    ],
  },
  {
    eyebrow: 'Save more the longer you shop',
    items: [
      {
        icon: '⭐',
        title: 'Earn and spend loyalty points',
        text: 'Every order earns 1 point per ₹10 you actually pay. Redeem points for ₹1 off each at checkout, or let them build — 500 lifetime points reaches Silver, 1,500 reaches Gold, each unlocking free shipping and a higher earn rate on every order after.',
        to: '/rewards',
        cta: 'View your points',
      },
      {
        icon: '🤝',
        title: 'Refer a friend, earn ₹100',
        text: 'Your account page has a personal link to share — when a friend signs up and places their first order, you both get ₹100 off.',
        to: '/profile',
        cta: 'Get your link',
      },
      {
        icon: '📣',
        title: 'Become an affiliate',
        text: 'Bloggers, reviewers and creators can apply to earn a commission on every sale they bring in, paid once the order is delivered.',
        to: '/affiliate',
        cta: 'Apply',
      },
      {
        icon: '♻️',
        title: 'Return empty bottles for credit',
        text: 'Print a return label and send your empty glass bottles back for ₹20 credit each.',
      },
    ],
  },
  {
    eyebrow: 'For bigger orders',
    items: [
      {
        icon: '🗓️',
        title: 'Reserve a share of a pressing run',
        text: 'See what\'s scheduled to be pressed before it happens, and book bottles from that exact run — including a short video once it\'s done.',
        to: '/pressings',
        cta: "See what's pressing",
      },
      {
        icon: '📦',
        title: 'Ask about wholesale',
        text: 'Buying for a shop, tiffin centre or event? Send us the quantities you need and we\'ll quote you.',
        to: '/bulk-enquiry',
        cta: 'Send an enquiry',
      },
    ],
  },
  {
    eyebrow: 'Visit or install',
    items: [
      {
        icon: '📍',
        title: 'Find the mill or the shop',
        text: 'Get the address and directions to both the Udumalpet mill and the Vedapatti shop.',
        to: '/store-locator',
        cta: 'Get directions',
      },
      {
        icon: '📲',
        title: 'Install this as an app',
        text: 'On Android or Chrome, accept the install prompt when it appears — or use the browser\'s own "Install app" option. On iPhone, use Safari\'s Share button and choose "Add to Home Screen".',
      },
    ],
  },
];

export default function HowToUse() {
  return (
    <div className="policy-page">
      <SeoMeta
        title="How to Use This Site — Western Gods Organics"
        description="A practical guide to every feature on the site — the AI assistant, batch lookup, subscriptions, loyalty points and more — step by step."
        path="/how-to-use"
      />
      <div className="breadcrumb">Home / How to Use This Site</div>
      <div className="flex gap-2" style={{ alignItems: 'center', marginBottom: 4 }}>
        <ChakkiWheel size={40} />
        <span className="eyebrow" style={{ margin: 0 }}>How to use this site</span>
      </div>
      <h1>Everything here, and how to actually use it</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Not a list of features — a plain "here's how" for each one, grouped by what you're
        actually trying to do. Prefer to be walked through it one step at a time instead?
        Try the <Link to="/getting-started">guided version</Link>, or{' '}
        <Link to="/how-to-shop">the shopping &amp; checkout guide</Link> if you're here to buy
        something specifically.
      </p>

      {GROUPS.map((group) => (
        <div className="howto-group" key={group.eyebrow}>
          <span className="eyebrow">{group.eyebrow}</span>
          <div className="howto-grid">
            {group.items.map((item, i) => (
              <Reveal className="howto-card" key={item.title} delay={(i % 4) * 60}>
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
              </Reveal>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
