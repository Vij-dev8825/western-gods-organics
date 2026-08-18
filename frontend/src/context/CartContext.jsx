import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../api';
import { trackAddToCart } from '../utils/analytics';
import { hapticTap } from '../utils/haptics';

const CartContext = createContext(null);
const GUEST_KEY = 'yo_guest_cart';

function loadGuestCart() {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY)) || [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const { token, isLoggedIn } = useAuth();
  const [items, setItems] = useState(loadGuestCart);
  const [synced, setSynced] = useState(false);

  // Mirrors `items` synchronously (refs update immediately, state doesn't) so
  // addItem/removeItem/etc. can be called several times back-to-back in the
  // same tick (e.g. "Buy Again" re-adding every line of a past order) without
  // each call reading the same stale pre-update array from a state closure.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Re-sync whenever the logged-in identity changes (login, logout, or
  // switching accounts on the same device) — otherwise `synced` stays true
  // forever after the first login and later sessions keep showing whichever
  // account's cart happened to load first.
  useEffect(() => {
    setSynced(false);
    if (!token) setItems(loadGuestCart());
  }, [token]);

  // On login: merge guest cart into server cart once.
  useEffect(() => {
    if (!isLoggedIn || synced) return;

    const guestItems = loadGuestCart();

    api
      .getCart(token)
      .then(async (data) => {
        let merged = data.items || [];
        if (guestItems.length) {
          guestItems.forEach((g) => {
            const existing = merged.find((m) => m.productId === g.productId && m.size === g.size);
            if (existing) existing.quantity += g.quantity;
            else merged.push(g);
          });
          await api.syncCart(token, merged);
          localStorage.removeItem(GUEST_KEY);
        }
        setItems(merged);
        setSynced(true);
      })
      .catch(() => setSynced(true));
  }, [isLoggedIn, token, synced]);

  const persist = useCallback(
    (newItems) => {
      itemsRef.current = newItems;
      setItems(newItems);
      if (isLoggedIn && token) {
        api.syncCart(token, newItems).catch(() => {});
      } else {
        localStorage.setItem(GUEST_KEY, JSON.stringify(newItems));
      }
    },
    [isLoggedIn, token]
  );

  function addItem(productId, size, quantity = 1) {
    // Top of the funnel. Price and name aren't available here — the cart only
    // stores ids — but GA4 accepts an item on its id alone, and the count is
    // what matters for "how many people add something and never check out".
    trackAddToCart({ id: productId, size, quantity });
    // Every add-to-cart in the app funnels through here — card, product page,
    // reorder — so the confirming tick belongs here rather than in each caller.
    hapticTap();
    const current = itemsRef.current;
    const existing = current.find((i) => i.productId === productId && i.size === size);
    let next;
    if (existing) {
      next = current.map((i) =>
        i.productId === productId && i.size === size ? { ...i, quantity: i.quantity + quantity } : i
      );
    } else {
      next = [...current, { productId, size, quantity }];
    }
    persist(next);
  }

  function updateQuantity(productId, size, quantity) {
    const next = itemsRef.current
      .map((i) => (i.productId === productId && i.size === size ? { ...i, quantity } : i))
      .filter((i) => i.quantity > 0);
    persist(next);
  }

  function removeItem(productId, size) {
    persist(itemsRef.current.filter((i) => !(i.productId === productId && i.size === size)));
  }

  function clearCart() {
    persist([]);
  }

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clearCart, totalCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
