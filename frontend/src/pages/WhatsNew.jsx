/**
 * A running showcase of what shopping here now includes — for customers,
 * not a developer changelog. Everything here is something a shopper can
 * actually do or see; the admin-only tooling behind it (margin reports,
 * audit logs, the seller commission console, and so on) stays out of this
 * page on purpose.
 */
import { Link } from 'react-router-dom';
import SeoMeta from '../components/SeoMeta';

const SECTIONS = [
  {
    eyebrow: 'Checkout',
    title: 'Shop your way',
    intro: 'From a quick guest order to a saved address book, checkout bends to how you actually want to buy.',
    items: [
      { icon: '⚡', title: 'No account needed', desc: 'Check out as a guest — verify by a one-time code sent to your phone and you’re done. An account is created for you automatically, ready the next time you order.' },
      { icon: '💳', title: 'Pay however suits you', desc: 'Pay online, pay cash on delivery, or pay a small advance now and the rest when it arrives.' },
      { icon: '📍', title: 'A real address book', desc: 'Save more than one delivery address and pick between them at checkout — no retyping.' },
      { icon: '🏭', title: 'Pick up at the mill', desc: 'Skip the courier — collect your order directly from Udumalpet during our posted pickup hours, or ask about our local delivery rate nearby.' },
      { icon: '🎁', title: 'Sending a gift?', desc: 'Add a free note and hide the price on the packing slip — the recipient sees a gift, not an invoice.' },
      { icon: '↩️', title: 'Cancel or return', desc: 'Cancel an order yourself before it ships, or request a return once it’s delivered — no phone call required.' },
    ],
  },
  {
    eyebrow: 'Discovery',
    title: 'Find the right product faster',
    intro: 'Less scrolling, more finding — especially if you’re not sure what you need yet.',
    items: [
      { icon: '🧭', title: 'Product finder quiz', desc: 'Tell us what you’re shopping for — hair, skin, kitchen — and for hair/skin care we’ll ask a couple more questions and hand back a short, personal routine.' },
      { icon: '📸', title: 'Reviews with real photos', desc: 'See what other customers actually received, not just star ratings — up to four photos per review, with a full breakdown of how people rated it.' },
      { icon: '💗', title: 'Wishlist price alerts', desc: 'Save something for later and we’ll tell you if the price drops.' },
      { icon: '🔔', title: 'Back-in-stock alerts', desc: 'Out of your size? Ask to be notified the moment it’s back, for that size specifically.' },
      { icon: '🛍️', title: 'Recommended for you', desc: 'Your homepage picks lean toward what you actually buy, and a "recently viewed" strip keeps track of what you looked at.' },
      { icon: '⚖️', title: 'Honest price comparison', desc: 'Every product page shows our price against a typical market price for the same quantity — so "premium" isn’t just a word.' },
    ],
  },
  {
    eyebrow: 'Traceability',
    title: 'Trust you can actually verify',
    intro: 'Not marketing claims — a batch code you can look up yourself.',
    items: [
      { icon: '🔍', title: 'Batch passport', desc: 'Scan or type the batch code on your bottle to see exactly when it was pressed, which grower and village it came from, its FSSAI licence, and a lab report.' },
      { icon: '🗓️', title: 'Pressing calendar', desc: 'See our upcoming and recent pressing runs — including short clips from the mill — and reserve a bottle from a run before it’s even pressed.' },
      { icon: '♻️', title: 'Bottle return-for-credit', desc: 'Send your empty glass bottles back for a ₹20 credit each, using a printable return label. Our sustainability page shows the real, running count of glass we’ve kept out of landfill — not an estimate.' },
      { icon: '🌱', title: 'Sourcing, in the open', desc: 'A dedicated page on where our raw materials actually come from.' },
    ],
  },
  {
    eyebrow: 'Rewards',
    title: 'Rewards that add up',
    intro: 'Ways to save that get better the longer you shop with us.',
    items: [
      { icon: '🤝', title: 'Refer a friend', desc: '₹100 off for you, ₹100 off for them, the moment they order.' },
      { icon: '⭐', title: 'Loyalty points & tiers', desc: 'Earn points on every order and redeem them for discounts. Reach Silver or Gold status for perks like free shipping and early access to new products before anyone else can buy them.' },
      { icon: '💌', title: 'Digital gift cards', desc: 'Send a gift card in any amount, with a personal message — usable on any order, and stackable with a coupon.' },
      { icon: '🔁', title: 'Subscribe & Save', desc: 'Put your regulars on autopilot for 10% off every recurring order, on a schedule you set, with optional auto-pay so you never have to remember.' },
      { icon: '📦', title: 'Wholesale pricing', desc: 'Buying in bulk for a shop, tiffin centre, or business? Ask about wholesale rates.' },
    ],
  },
  {
    eyebrow: 'Marketplace',
    title: 'A growing shelf of makers',
    intro: 'We’re no longer the only ones on our own shelf.',
    items: [
      { icon: '🧑‍🌾', title: 'Meet the Makers', desc: 'Browse a directory of other small producers we’ve vetted and welcomed onto the site, each with their own storefront — every listing is clearly marked as ours or theirs.' },
      { icon: '🏢', title: 'Corporate & festival gifting', desc: 'Hampers for corporate or festival gifting, with a bulk enquiry form for larger orders.' },
    ],
  },
  {
    eyebrow: 'Support',
    title: 'Talk to us however you like',
    intro: 'Real answers, on the channel you’re already using.',
    items: [
      { icon: '💬', title: 'Order updates on WhatsApp', desc: 'Your login code and order updates can arrive on WhatsApp instead of SMS — sent from our actual business number.' },
      { icon: '🤖', title: '"Shop with AI" assistant', desc: 'Ask it a question in plain language and it answers using our real product details, showing you the actual products it means, not just naming them.' },
      { icon: '❓', title: 'Ask about any product', desc: 'Post a question directly on a product page and get a real answer from us.' },
      { icon: '👍', title: 'One-tap delivery feedback', desc: 'A quick, no-login rating after delivery — tell us how it went in a few taps.' },
    ],
  },
  {
    eyebrow: 'Festive & seasonal',
    title: 'The site dresses itself for the season',
    intro: 'This is the newest and most elaborate part of the site — built to feel like an actual festival, not a banner about one.',
    items: [
      { icon: '🪔', title: 'A little ritual for every festival', desc: 'Light a row of diyas, lay a ring of a pookalam, watch a Pongal pot boil over, throw colour on Holi, wind a rakhi thread, or climb Annamalai hill lamp by lamp for Karthigai Deepam — each festival gets the gesture that’s actually performed on that day, not a generic tap-five-times widget.' },
      { icon: '🌸', title: 'Weather for the season', desc: 'Flowers drift down for Onam and Vishu, sparks rise for lamp festivals, colour hangs in the air for Holi, and quiet glints mark the more solemn or ceremonial days — because fireworks over a prayer would be wrong.' },
      { icon: '💃', title: 'Dancing festival characters', desc: 'A small troupe — Maveli with his umbrella, a pulikali tiger, a Pongal bull, Dandiya dancers and more — dances along the homepage in festival costume, cast differently for each occasion.' },
      { icon: '🌺', title: 'A garland at the door', desc: 'A real toran hangs across the top of the site during festival season, the way one would hang over an actual doorway — marigold and mango leaf, a jasmine string, or brass bells, with a banana tree and a coconut tree flanking either side just like a real festival entrance.' },
      { icon: '🎨', title: 'Build your own Onam pookalam', desc: 'A full flower-mandala game at our Onam page: up to 200 flowers, radial-symmetry tools, colour themes, ready-made templates, a 6-minute challenge mode, and a design contest you can enter for a chance to win.' },
    ],
  },
  {
    eyebrow: 'Reach',
    title: 'Wherever you are',
    intro: '',
    items: [
      { icon: '🌍', title: 'Shipping beyond India', desc: 'International shipping with country-specific rates, plus a dedicated page for overseas buyers and distributors.' },
      { icon: '🗣️', title: 'Read it in your language', desc: 'Product details are available in Hindi, Tamil, Telugu and Kannada alongside English.' },
      { icon: '🗺️', title: 'Visit us in person', desc: 'A store locator for our physical locations, with directions and what each one can help with.' },
      { icon: '📲', title: 'Add us to your home screen', desc: 'Install the site like an app for quicker access next time.' },
    ],
  },
];

export default function WhatsNew() {
  return (
    <div>
      <SeoMeta
        title="What's New — Western Gods Organics"
        description="See everything new added to the shop lately — flexible checkout, batch traceability, rewards, festive site features and more."
        path="/whats-new"
      />
      <div className="whats-new-hero">
        <span className="eyebrow">Always growing</span>
        <h1>What's New</h1>
        <p className="muted" style={{ fontSize: '1.02rem' }}>
          We keep adding to the shop — some of it useful, some of it just for the joy of it.
          Here's everything new since we started, in plain terms.
        </p>
      </div>

      <div className="container">
        {SECTIONS.map((section) => (
          <section className="whats-new-section" key={section.title}>
            <span className="eyebrow">{section.eyebrow}</span>
            <h2>{section.title}</h2>
            {section.intro && <p className="muted" style={{ maxWidth: 640 }}>{section.intro}</p>}
            <div className="whats-new-grid">
              {section.items.map((item) => (
                <div className="whats-new-card" key={item.title}>
                  <span className="whats-new-icon" aria-hidden="true">{item.icon}</span>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        <div style={{ textAlign: 'center', padding: '20px 0 60px' }}>
          <Link to="/shop" className="btn btn-gold">Start shopping</Link>
        </div>
      </div>
    </div>
  );
}
