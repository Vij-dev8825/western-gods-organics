import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { CANONICAL_ORIGIN } from '../../utils/site';

// Kept in the browser rather than the database: this is a personal drafting
// aid for whoever is doing the messaging, not a shop setting other people
// need to agree on, and a round-trip per keystroke would make editing worse.
const TEMPLATE_KEY = 'wgo_share_templates';

/** The link a shared message points at. utm_* is what lets Google Analytics
 * separate "someone I messaged" from "someone who found us" — without it
 * every hand-sent order looks like direct traffic and the outreach can't be
 * told apart from luck. */
function shareUrl(productId, campaign) {
  const params = new URLSearchParams({
    utm_source: 'whatsapp',
    utm_medium: 'share',
    utm_campaign: campaign || 'direct-outreach',
  });
  return `${CANONICAL_ORIGIN}/product/${productId}?${params}`;
}

const PLACEHOLDER_HELP = '{name} {price} {size} {link}';

const DEFAULT_TEMPLATES = [
  {
    id: 'intro',
    label: 'First message',
    body:
      "Hello! We've put our mill online — you can now order our {name} ({size}, ₹{price}) straight to your door.\n\n" +
      'Same oil, same wood press, nothing added. Every bottle has its batch number and pressing date on the site.\n\n{link}',
  },
  {
    id: 'offer',
    label: 'With an offer',
    body:
      'Our {name} is now on the website — {size} for ₹{price}.\n\n' +
      "Use code WELCOME10 for 10% off your first order. Cash on delivery is available if you'd rather not pay online.\n\n{link}",
  },
  {
    id: 'pressing',
    label: 'Next pressing',
    body:
      "We're pressing {name} fresh this week. You can reserve a bottle from the run before it's done — " +
      'it goes out the day it comes off the press.\n\n{link}',
  },
];

function render(body, product, size) {
  return body
    .replaceAll('{name}', product.name)
    .replaceAll('{size}', size?.label || '')
    .replaceAll('{price}', size ? String(size.price) : '')
    .replaceAll('{link}', shareUrl(product.id));
}

/**
 * Ready-to-send product messages for reaching customers one at a time.
 *
 * The first orders for a shop with none come from people who already know the
 * mill, messaged individually — not from advertising. This just removes the
 * retyping: pick a product, pick a wording, and send. Every link carries
 * campaign tags so those orders show up in Analytics as outreach rather than
 * vanishing into "direct".
 */
export default function AdminShare() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [templates, setTemplates] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TEMPLATE_KEY));
      return Array.isArray(saved) && saved.length ? saved : DEFAULT_TEMPLATES;
    } catch {
      return DEFAULT_TEMPLATES;
    }
  });
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATES[0].id);
  const [productId, setProductId] = useState('');
  const [sizeLabel, setSizeLabel] = useState('');

  useEffect(() => {
    api.getProducts({}, token).then((d) => {
      setProducts(d.products);
      if (d.products.length) {
        setProductId(d.products[0].id);
        setSizeLabel(d.products[0].sizes?.[0]?.label || '');
      }
    }).catch(() => {});
  }, [token]);

  const product = products.find((p) => p.id === productId);
  const size = product?.sizes?.find((s) => s.label === sizeLabel) || product?.sizes?.[0];
  const template = templates.find((t) => t.id === templateId) || templates[0];

  const message = useMemo(
    () => (product && template ? render(template.body, product, size) : ''),
    [product, template, size]
  );

  function updateTemplateBody(body) {
    const next = templates.map((t) => (t.id === templateId ? { ...t, body } : t));
    setTemplates(next);
    try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }

  function resetTemplates() {
    setTemplates(DEFAULT_TEMPLATES);
    try { localStorage.removeItem(TEMPLATE_KEY); } catch { /* ignore */ }
    showToast('Wordings reset to the originals.');
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      showToast('Message copied — paste it into WhatsApp.');
    } catch {
      showToast('Could not copy automatically — select the text and copy it.', 'error');
    }
  }

  return (
    <div>
      <h2>Share &amp; promote</h2>
      <p className="muted" style={{ maxWidth: 660 }}>
        Ready-made messages for sending to customers one at a time — the way a shop's first
        orders actually arrive. Pick a product and a wording, then copy it or open WhatsApp
        directly. Every link is tagged, so any order that follows shows up in Analytics as
        outreach instead of disappearing into “direct traffic”.
      </p>

      <div className="card" style={{ padding: 18, margin: '18px 0', maxWidth: 660 }}>
        <div className="field">
          <label htmlFor="share-product">Product</label>
          <select id="share-product" value={productId} onChange={(e) => {
            setProductId(e.target.value);
            const p = products.find((x) => x.id === e.target.value);
            setSizeLabel(p?.sizes?.[0]?.label || '');
          }}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="share-size">Size to mention</label>
          <select id="share-size" value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)}>
            {(product?.sizes || []).map((s) => (
              <option key={s.label} value={s.label}>{s.label} — ₹{s.price}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="share-wording">Wording</label>
          <select id="share-wording" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="share-wording-body">Edit this wording <span className="muted">— placeholders: {PLACEHOLDER_HELP}</span></label>
          <textarea
            id="share-wording-body"
            rows={7}
            value={template?.body || ''}
            onChange={(e) => updateTemplateBody(e.target.value)}
          />
          <button type="button" className="link-btn" onClick={resetTemplates}>
            Reset all wordings
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 18, maxWidth: 660 }}>
        <h4 style={{ marginTop: 0 }}>Ready to send</h4>
        <pre className="share-preview">{message || 'Choose a product to see the message.'}</pre>
        <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-gold btn-sm" onClick={copyMessage} disabled={!message}>
            Copy message
          </button>
          <a
            className="btn btn-outline btn-sm"
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in WhatsApp
          </a>
        </div>
        <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 0, marginTop: 12 }}>
          “Open in WhatsApp” lets you pick the contact yourself — nothing is sent until you press send there.
        </p>
      </div>
    </div>
  );
}
