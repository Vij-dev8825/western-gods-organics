import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { getProductImage } from '../utils/productImages';
import { flyToCart } from '../utils/flyToCart';

/** `onNavigate` lets a host that floats over the page — the AI panel — get out
 * of the way when a card sends the shopper somewhere. Optional: the Shop page
 * renders these cards inline, where there's nothing to close. */
export function ProductChatCard({ product, onNavigate }) {
  const { addItem } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  if (!product) return null;

  const sizes = product.sizes || [];
  const prices = sizes.map((s) => s.price);
  const priceLabel = prices.length
    ? prices.length > 1
      ? `₹${Math.min(...prices)}–₹${Math.max(...prices)}`
      : `₹${prices[0]}`
    : '';
  const defaultSize = sizes.find((s) => s.stock > 0);

  function handleAddToCart(e) {
    if (!defaultSize) return;
    flyToCart(e.currentTarget.closest('.ai-product-card')?.querySelector('img'));
    addItem(product.id, defaultSize.label, 1);
    showToast(`${product.name} (${defaultSize.label}) added to cart`);
  }

  // Straight to checkout with just this item, the same shape Product Detail's
  // Buy Now sends (see pages/ProductDetail.jsx) so the cart reads it the same
  // way — a recommendation the shopper already likes shouldn't need a detour
  // through the product page to be bought.
  function handleBuyNow() {
    if (!defaultSize) return;
    onNavigate?.();
    navigate('/cart', {
      state: { buyNow: { productId: product.id, size: defaultSize.label, quantity: 1 } },
    });
  }

  return (
    <div className="ai-product-card">
      <img src={getProductImage(product.image)} alt={product.name} />
      <div className="ai-product-card-info">
        <b>{product.name}</b>
        <span className="muted">{priceLabel}</span>
        <div className="ai-product-card-actions">
          {/* Closes the panel on the way out — it floats above the page, so
              leaving it open would land the shopper on a product page hidden
              behind the chat they just used to find it. */}
          <Link to={`/product/${product.id}`} className="btn btn-outline btn-sm" onClick={() => onNavigate?.()}>
            View
          </Link>
          <button type="button" className="btn btn-outline btn-sm" disabled={!defaultSize} onClick={handleAddToCart}>
            {defaultSize ? 'Add' : 'Out of stock'}
          </button>
          {defaultSize && (
            <button type="button" className="btn btn-gold btn-sm" onClick={handleBuyNow}>
              Buy now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** "Shop with AI" — a stateless AI assistant (Google Gemini, free tier) that
 * can recommend products and answer store-policy questions instantly with
 * no login, separate from ChatWidget's login-gated human support thread.
 * Conversation history lives only in this component's state — nothing is
 * persisted server-side. Product recommendations render as real cards
 * (image, price, Add to Cart) rather than just naming them in text. */
export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { from: 'user' | 'bot', text, productIds? }
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [products, setProducts] = useState([]);
  const bottomRef = useRef(null);
  const location = useLocation();
  const { token } = useAuth();

  // Hidden on admin/login and on cart/checkout, where it crowds the "Place order" button on mobile.
  const hidden = location.pathname.startsWith('/admin') || location.pathname === '/login' || location.pathname === '/cart';

  useEffect(() => {
    api.getProducts().then((d) => setProducts(d.products)).catch(() => {});
  }, []);

  // Follows the reply as it streams, not just when a message is added — the
  // count doesn't change while text is arriving, so keying on it alone would
  // let a long answer grow off the bottom of the panel.
  const lastMessageLength = messages[messages.length - 1]?.text?.length || 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, lastMessageLength, open, sending]);

  if (hidden) return null;

  async function ask(question) {
    const t = question.trim();
    if (!t || sending) return;
    const priorMessages = messages;
    // An empty bot bubble goes up straight away and fills in as the answer
    // streams, so the reply starts appearing in about a second instead of
    // the customer watching a dot for eight.
    setMessages((m) => [...m, { from: 'user', text: t }, { from: 'bot', text: '' }]);
    setText('');
    setSending(true);

    const appendToReply = (delta) =>
      setMessages((m) => {
        const next = [...m];
        const last = next.length - 1;
        next[last] = { ...next[last], text: next[last].text + delta };
        return next;
      });

    try {
      const { productIds, suggestions } = await api.streamAiAssistant(t, priorMessages, token, appendToReply);
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { ...next[next.length - 1], productIds, suggestions };
        return next;
      });
    } catch (err) {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { from: 'bot', text: err.message || 'Something went wrong — please try again.' };
        return next;
      });
    } finally {
      setSending(false);
    }
  }

  function handleSend(e) {
    e.preventDefault();
    ask(text);
  }

  return (
    <>
      {open && (
        <div className="chat-panel ai-assistant-panel" role="dialog" aria-label="Shop with AI">
          <div className="chat-head">
            <div>
              <b>✨ Shop with AI</b>
              <span>Ask about products, shipping, or policies</span>
            </div>
            <button aria-label="Close AI assistant" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="chat-body">
            {messages.length === 0 && (
              <div className="chat-empty">
                Hi! Ask me things like "what's good for dry skin" or "do you ship to the US?"
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i}>
                <div className={`chat-msg ${m.from === 'user' ? 'mine' : 'theirs'}`}>
                  {/* The bubble goes up empty and fills as the reply streams,
                      so the waiting dots live inside it rather than as a
                      separate row that would jump when the text arrives. */}
                  {m.text || (m.from === 'bot' ? <span className="chat-typing">…</span> : '')}
                </div>
                {m.productIds?.length > 0 && (
                  <div className="ai-product-cards">
                    {m.productIds.map((id) => (
                      <ProductChatCard
                        key={id}
                        product={products.find((p) => p.id === id)}
                        onNavigate={() => setOpen(false)}
                      />
                    ))}
                  </div>
                )}
                {/* Follow-ups, only on the newest reply — older ones would
                    stack up as a wall of stale prompts as the chat grows. */}
                {m.from === 'bot' && i === messages.length - 1 && m.suggestions?.length > 0 && !sending && (
                  <div className="ai-suggestions">
                    {m.suggestions.map((s) => (
                      <button key={s} type="button" className="ai-suggestion" onClick={() => ask(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form className="chat-input" onSubmit={handleSend}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask the AI assistant…"
              maxLength={500}
            />
            <button type="submit" className="btn btn-gold btn-sm" disabled={!text.trim() || sending}>
              Send
            </button>
          </form>
        </div>
      )}

      <button
        className="ai-assistant-fab"
        aria-label={open ? 'Close AI assistant' : 'Shop with AI'}
        onClick={() => setOpen((o) => !o)}
      >
        {!open && <span className="fab-label">Shop with AI</span>}
        {open ? '✕' : '✨'}
      </button>
    </>
  );
}
