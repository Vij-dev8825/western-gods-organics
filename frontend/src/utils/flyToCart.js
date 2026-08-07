// Cart icon lives in Navbar, a totally separate component tree from any
// "Add to cart" button (ProductCard, ProductDetail, the AI assistant's chat
// cards) — a DOM id lookup at call time is simpler than threading a ref
// through contexts just for this, and mirrors the event-based approach
// already used by utils/routeProgress.js for the same kind of cross-tree signal.
const CART_ICON_ID = 'navbar-cart-icon';
const FLIGHT_MS = 650;

/** Animates a clone of `imgEl` flying from its current position to the
 * navbar cart icon, then bounces the icon. No-ops quietly if either
 * element isn't found (e.g. a layout without a cart icon) or under
 * prefers-reduced-motion, where it just bounces the icon immediately. */
export function flyToCart(imgEl) {
  const cartIcon = document.getElementById(CART_ICON_ID);
  if (!cartIcon) return;

  if (!imgEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    bounceCartIcon(cartIcon);
    return;
  }

  const startRect = imgEl.getBoundingClientRect();
  const endRect = cartIcon.getBoundingClientRect();
  if (!startRect.width || !startRect.height) return;

  const clone = imgEl.cloneNode(true);
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${startRect.left}px`,
    top: `${startRect.top}px`,
    width: `${startRect.width}px`,
    height: `${startRect.height}px`,
    borderRadius: '10px',
    objectFit: 'cover',
    zIndex: 9999,
    pointerEvents: 'none',
    margin: 0,
    transition: `transform ${FLIGHT_MS}ms cubic-bezier(0.5, -0.2, 0.7, 1), opacity ${FLIGHT_MS}ms ease`,
    willChange: 'transform, opacity',
  });
  document.body.appendChild(clone);

  const dx = endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2);
  const dy = endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2);

  requestAnimationFrame(() => {
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.12)`;
    clone.style.opacity = '0.3';
  });

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clone.remove();
    bounceCartIcon(cartIcon);
  };
  clone.addEventListener('transitionend', finish, { once: true });
  // Safety net — a hidden tab or dropped frame can skip transitionend.
  setTimeout(finish, FLIGHT_MS + 200);
}

function bounceCartIcon(cartIcon) {
  cartIcon.classList.remove('cart-icon-bounce');
  void cartIcon.offsetWidth; // force reflow so back-to-back adds re-trigger the animation
  cartIcon.classList.add('cart-icon-bounce');
}
