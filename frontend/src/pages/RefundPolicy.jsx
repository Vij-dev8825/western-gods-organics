import SeoMeta from '../components/SeoMeta';

export default function RefundPolicy() {
  return (
    <div className="policy-page">
      <SeoMeta
        title="Refund & Returns Policy | Western Gods Organics"
        description="How Western Gods Organics handles damaged, incorrect, or quality-concern returns on cold-pressed oils, plus refund timelines and how to request one."
        path="/refund-policy"
      />
      <div className="breadcrumb">Home / Refund Policy</div>
      <span className="eyebrow">Legal</span>
      <h1>Refund &amp; Returns Policy</h1>
      <p className="muted">Last updated: July 2026</p>

      <p>
        Because our oils are food products, we handle returns carefully to keep every bottle
        safe to consume. Here's how it works.
      </p>

      <h2>Damaged or incorrect items</h2>
      <ul>
        <li>If your bottle arrives damaged, leaking, or the wrong product/size was delivered, contact us within 48 hours of delivery with photos.</li>
        <li>We'll arrange a free replacement or a full refund — your choice.</li>
      </ul>

      <h2>7-Day Return Policy</h2>
      <ul>
        <li>If you believe an unopened, sealed bottle doesn't meet our quality promise, let us know within 7 days of delivery.</li>
        <li>Our team may request the batch code (printed on the label) to investigate.</li>
      </ul>

      <h2>What we can't accept back</h2>
      <ul>
        <li>Opened or used bottles, for hygiene and food-safety reasons</li>
        <li>Change-of-mind returns once a bottle has been opened</li>
        <li>Bulk/wholesale orders, which are covered under separate supply terms</li>
      </ul>

      <h2>Refund timelines</h2>
      <ul>
        <li>Approved refunds are processed within 5-7 business days to the original payment method</li>
        <li>Cash on Delivery refunds are made via bank transfer or UPI</li>
      </ul>

      <h2>How to request a refund or replacement</h2>
      <p>
        Email <a href="mailto:westerngodsorganic@gmail.com">westerngodsorganic@gmail.com</a> with your
        order number, or use our <a href="/contact">Contact Us</a> page, and our team will
        guide you through the process.
      </p>
    </div>
  );
}
