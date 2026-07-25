import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { getProductImage } from '../utils/productImages';

function ProductChatCard({ product }) {
  const { addItem } = useCart();
  const { showToast } = useToast();
  if (!product) return null;

  const sizes = product.sizes || [];
  const prices = sizes.map((s) => s.price);
  const priceLabel = prices.length
    ? prices.length > 1
      ? `₹${Math.min(...prices)}–₹${Math.max(...prices)}`
      : `₹${prices[0]}`
    : '';
  const defaultSize = sizes.find((s) => s.stock > 0);

  function handleAddToCart() {
    if (!defaultSize) return;
    addItem(product.id, defaultSize.label, 1);
    showToast(`${product.name} (${defaultSize.label}) added to cart`);
  }

  return (
    <div className="ai-product-card">
      <img src={getProductImage(product.image)} alt={product.name} />
      <div className="ai-product-card-info">
        <b>{product.name}</b>
        <span className="muted">{priceLabel}</span>
        <div className="ai-product-card-actions">
          <Link to={`/product/${product.id}`} className="btn btn-outline btn-sm">View</Link>
          <button type="button" className="btn btn-gold btn-sm" disabled={!defaultSize} onClick={handleAddToCart}>
            {defaultSize ? 'Add to cart' : 'Out of stock'}
          </button>
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

  // Hidden on admin/login and on cart/checkout, where it crowds the "Place order" button on mobile.
  const hidden = location.pathname.startsWith('/admin') || location.pathname === '/login' || location.pathname === '/cart';

  useEffect(() => {
    api.getProducts().then((d) => setProducts(d.products)).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, open, sending]);

  if (hidden) return null;

  async function handleSend(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    const priorMessages = messages;
    setMessages((m) => [...m, { from: 'user', text: t }]);
    setText('');
    setSending(true);
    try {
      const d = await api.askAiAssistant(t, priorMessages);
      setMessages((m) => [...m, { from: 'bot', text: d.reply, productIds: d.productIds }]);
    } catch (err) {
      setMessages((m) => [...m, { from: 'bot', text: err.message || 'Something went wrong — please try again.' }]);
    } finally {
      setSending(false);
    }
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
                  {m.text}
                </div>
                {m.productIds?.length > 0 && (
                  <div className="ai-product-cards">
                    {m.productIds.map((id) => (
                      <ProductChatCard key={id} product={products.find((p) => p.id === id)} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && <div className="chat-msg theirs">…</div>}
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
