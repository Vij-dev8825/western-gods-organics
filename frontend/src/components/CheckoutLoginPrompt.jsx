/** Shown once, when a signed-out shopper taps "Proceed to checkout" — the
 * moment logging in is still worth it, rather than after they've typed the
 * whole form. Neither choice is a dead end: logging in fills their saved
 * name, email, phone and address in for them, and carrying on as a guest
 * goes straight to the same checkout. */
export default function CheckoutLoginPrompt({ onLogin, onGuest }) {
  return (
    <div className="promo-popup-overlay" role="dialog" aria-modal="true" aria-label="Log in or continue as a guest">
      <div className="promo-popup-card checkout-prompt-card">
        <span className="promo-popup-badge">🌿 Before you check out</span>
        <h3>Already shopped with us?</h3>
        <p className="muted">
          Log in and your name, email, phone and delivery address fill in
          automatically. Or carry straight on — we only need a few details.
        </p>
        <div className="checkout-prompt-actions">
          <button type="button" className="btn btn-gold btn-block" onClick={onLogin}>
            Log in
          </button>
          <button type="button" className="btn btn-outline btn-block" onClick={onGuest}>
            Continue as guest
          </button>
        </div>
        <p className="muted checkout-prompt-note">
          Either way you can pay by card, UPI or Cash on Delivery.
        </p>
      </div>
    </div>
  );
}
