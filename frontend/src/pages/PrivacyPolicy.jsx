export default function PrivacyPolicy() {
  return (
    <div className="policy-page">
      <div className="breadcrumb">Home / Privacy Policy</div>
      <span className="eyebrow">Legal</span>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: July 2026</p>

      <p>
        Western Gods Organics ("we", "us", "our") respects your privacy. This policy explains what
        information we collect when you use our website, and how we use it.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Mobile number, used to log in via OTP</li>
        <li>Name, email and delivery address, if you provide them</li>
        <li>Order history and cart/wishlist contents</li>
        <li>Basic usage data (pages visited, device/browser type) for improving the site</li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To process and deliver your orders</li>
        <li>To respond to enquiries, including bulk sales requests</li>
        <li>To send order updates via SMS/email/WhatsApp</li>
        <li>To improve our products, website and customer service</li>
      </ul>

      <h2>What we don't do</h2>
      <ul>
        <li>We never sell your personal data to third parties</li>
        <li>We don't store card details on our servers</li>
      </ul>

      <h2>Your choices</h2>
      <p>
        You can update or delete your profile details from your account page at any time,
        or write to us at <a href="mailto:hello@yamunaorganics.com">hello@yamunaorganics.com</a> to
        request full data deletion.
      </p>

      <h2>Cookies</h2>
      <p>
        We use essential cookies/local storage to keep you logged in and remember your cart
        and wishlist between visits. We don't use third-party advertising cookies.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Reach us at{' '}
        <a href="mailto:hello@yamunaorganics.com">hello@yamunaorganics.com</a> or through our{' '}
        <a href="/contact">Contact Us</a> page.
      </p>
    </div>
  );
}
