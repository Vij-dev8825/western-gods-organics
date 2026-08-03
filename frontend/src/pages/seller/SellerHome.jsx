import { Link } from 'react-router-dom';
import SeoMeta from '../../components/SeoMeta';

const BENEFITS = [
  {
    icon: '🛒',
    title: 'Sell to shoppers already here',
    text: "Your products appear in the same shop, search and category pages as ours — you're not starting a storefront from zero.",
  },
  {
    icon: '🏪',
    title: 'Your own storefront page',
    text: 'A public page with your business name, your story and all your listings, linked from every product you sell.',
  },
  {
    icon: '💸',
    title: 'Keep most of every sale',
    text: 'A single, flat platform fee agreed up front. No listing fees, no monthly subscription, no surprise deductions.',
  },
  {
    icon: '📦',
    title: 'We handle the checkout',
    text: 'Payments, COD, invoicing and order tracking all run on our existing system — you just manage your listings and stock.',
  },
  {
    icon: '💬',
    title: 'A real person to talk to',
    text: "Direct chat with our team from inside your seller dashboard — not a ticket queue, and not a bot.",
  },
  {
    icon: '⭐',
    title: 'Answer your own customers',
    text: 'Shopper questions on your products come straight to you, and your answers publish on the product page.',
  },
];

const STEPS = [
  { n: 1, title: 'Apply', text: 'Tell us your business name and what you make. Takes about two minutes.' },
  { n: 2, title: 'We review', text: 'We look at every application by hand — usually within a few business days.' },
  { n: 3, title: 'List your products', text: 'Add photos, sizes, prices and stock from your seller dashboard.' },
  { n: 4, title: 'Get paid', text: 'Your share of each delivered order is credited to your balance and paid out by bank transfer or UPI.' },
];

const FAQS = [
  {
    q: 'What does it cost to sell here?',
    a: 'Nothing to apply and nothing to list. We agree a flat platform fee with you when your application is approved — that percentage is the only thing deducted, and only on orders that actually get delivered.',
  },
  {
    q: 'When do I get paid?',
    a: "Your share is credited to your seller balance once an order containing your product is marked delivered — so a cancelled or returned order never pays out on a sale that didn't happen. We then transfer your balance to you by bank transfer or UPI.",
  },
  {
    q: 'Who handles delivery and customer payments?',
    a: 'We do. Orders for your products go through the same checkout, payment and tracking system as everything else on the site, so customers get one consistent experience.',
  },
  {
    q: 'Are my listings reviewed?',
    a: "Your first three listings are checked by us before they go live — it's how we keep quality consistent for shoppers. After that your listings publish instantly.",
  },
  {
    q: 'What can I sell?',
    a: 'Natural, honestly-made products in the spirit of what we already sell — cold-pressed oils, handmade soaps, herbal powders and similar. Tell us what you make in your application.',
  },
  {
    q: 'Do I need an existing online store?',
    a: 'No. Plenty of good makers sell only in person or through WhatsApp. If you make something well, that is enough to apply.',
  },
];

export default function SellerHome() {
  return (
    <>
      <SeoMeta
        title="Sell on Western Gods Organics — Seller Central"
        description="Apply to sell your cold-pressed oils, handmade soaps or herbal products on Western Gods Organics. Your own storefront, a flat platform fee, and payouts on every delivered order."
        path="/seller"
      />

      <section className="seller-hero">
        <div className="seller-hero-inner">
          <span className="eyebrow">Seller Central</span>
          <h1>Sell what you make, to people already looking for it.</h1>
          <p>
            Western Gods Organics is a small family mill in Udumalpet. We're opening our shop to other
            makers of genuinely natural products — your listings, your storefront, your name on every sale.
          </p>
          <div className="seller-hero-actions">
            <Link to="/seller/register" className="btn btn-gold">Start selling</Link>
            <Link to="/seller/login" className="btn btn-outline-light">I already have an account</Link>
          </div>
          <p className="seller-hero-note">Free to apply · No listing fees · No monthly charge</p>
        </div>
      </section>

      <section className="container section">
        <span className="eyebrow">Why sell with us</span>
        <h2>Built for makers, not marketplaces</h2>
        <div className="seller-benefit-grid">
          {BENEFITS.map((b) => (
            <div className="seller-benefit" key={b.title}>
              <span className="seller-benefit-icon" aria-hidden="true">{b.icon}</span>
              <h3>{b.title}</h3>
              <p className="muted">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="seller-steps-band">
        <div className="container">
          <span className="eyebrow">How it works</span>
          <h2>From application to first payout</h2>
          <div className="seller-steps">
            {STEPS.map((s) => (
              <div className="seller-step" key={s.n}>
                <span className="seller-step-num">{s.n}</span>
                <h3>{s.title}</h3>
                <p className="muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container section">
        <span className="eyebrow">Questions</span>
        <h2>Before you apply</h2>
        <div className="seller-faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p className="muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="seller-cta-band">
        <div className="container center">
          <h2>Ready to list your first product?</h2>
          <p className="muted" style={{ maxWidth: 520, margin: '0 auto 20px' }}>
            Applying takes about two minutes, and there's nothing to pay to get started.
          </p>
          <Link to="/seller/register" className="btn btn-gold">Start selling</Link>
        </div>
      </section>
    </>
  );
}
