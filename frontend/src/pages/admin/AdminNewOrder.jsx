/**
 * Writing down an order that came in by phone, on WhatsApp, or over the counter.
 *
 * Built to be used one-handed while someone is still on the line, so the phone
 * number comes first — it is what tells you whether this is a customer you
 * already have — and every choice below it is two or three buttons rather than
 * a dropdown to hunt through.
 *
 * The prices shown here are a preview. The server rebuilds the order from the
 * catalogue when it saves, so what the customer is charged is never whatever
 * this screen happened to be holding.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const PAYMENT = [
  { key: 'counter', label: 'Paid now', hint: 'Cash or UPI, already in hand' },
  { key: 'cod', label: 'Pay on delivery', hint: 'Still to collect' },
];

const DELIVERY = [
  { key: 'pickup', label: 'Collected at the mill', hint: 'Nothing charged for delivery' },
  { key: 'shipping', label: 'We send it', hint: 'Your usual delivery rate applies' },
  { key: 'to_pay', label: 'Courier collects', hint: 'The courier bills the customer directly' },
];

const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export default function AdminNewOrder() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [placed, setPlaced] = useState(null);

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('counter');
  const [shippingChoice, setShippingChoice] = useState('pickup');
  const [couponCode, setCouponCode] = useState('');
  const [note, setNote] = useState('');
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: '', pincode: '' });

  const [lines, setLines] = useState([]);
  const [pick, setPick] = useState({ productId: '', size: '', quantity: 1 });

  useEffect(() => {
    api.getProducts({}, token).then((d) => setProducts(d.products)).catch(() => {});
    api.admin.getCustomers(token).then((d) => setCustomers(d.customers)).catch(() => {});
  }, [token]);

  // Matched on the number as typed, the same way the server does it — so what
  // this says about "existing customer" is what will actually happen on save.
  const match = useMemo(
    () => (phone.trim() ? customers.find((c) => c.phone === phone.trim()) || null : null),
    [phone, customers]
  );

  // Fills the name for a customer you already have, but never overwrites
  // something already typed — the shop may be correcting a name on the call.
  useEffect(() => {
    if (match && !name) setName(match.name || '');
  }, [match]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosenProduct = products.find((p) => p.id === pick.productId) || null;
  const chosenSize = chosenProduct?.sizes?.find((s) => s.label === pick.size) || null;

  function addLine() {
    if (!chosenProduct || !chosenSize) return;
    const quantity = Math.max(1, Math.floor(Number(pick.quantity) || 1));
    setLines((prev) => {
      // Same product and size twice is one line with a bigger number on it,
      // which is how it would be read out loud.
      const at = prev.findIndex((l) => l.productId === chosenProduct.id && l.size === chosenSize.label);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], quantity: next[at].quantity + quantity };
        return next;
      }
      return [...prev, {
        productId: chosenProduct.id,
        name: chosenProduct.name,
        size: chosenSize.label,
        price: Number(chosenSize.price) || 0,
        stock: Number(chosenSize.stock) || 0,
        quantity,
      }];
    });
    setPick({ productId: '', size: '', quantity: 1 });
  }

  const goods = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  async function save() {
    setSaving(true);
    try {
      const d = await api.admin.createCounterOrder(token, {
        items: lines.map((l) => ({ productId: l.productId, size: l.size, quantity: l.quantity })),
        customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
        address: { ...address, name: name.trim() },
        paymentMethod,
        shippingChoice,
        couponCode: couponCode.trim() || undefined,
        note: note.trim(),
      });
      setPlaced(d);
      showToast(`Order ${d.order.orderNumber} recorded.`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setPlaced(null);
    setPhone(''); setName(''); setEmail('');
    setLines([]); setCouponCode(''); setNote('');
    setAddress({ line1: '', line2: '', city: '', state: '', pincode: '' });
    setPaymentMethod('counter'); setShippingChoice('pickup');
  }

  if (placed) {
    const o = placed.order;
    return (
      <div>
        <div className="section-head">
          <div><span className="eyebrow">Orders</span><h2>Order {o.orderNumber} recorded</h2></div>
        </div>
        <div className="form-card" style={{ maxWidth: 560 }}>
          <p style={{ marginTop: 0 }}>
            <b>{money(o.total)}</b> · {o.items.length} item(s) · {o.paymentMethod === 'counter' ? 'paid' : 'to collect on delivery'}
            {placed.createdAccount && <><br /><span className="muted">A new customer record was created for {phone}.</span></>}
          </p>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            It behaves exactly like a website order from here — it appears in Orders and Today,
            counts in Profit and the CSV exports, and the customer gets their invoice by
            WhatsApp and email when you mark it delivered.
          </p>
          <div className="flex gap-1" style={{ marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-gold" onClick={reset}>Record another</button>
            <Link to="/admin/orders" className="btn btn-outline">Go to Orders</Link>
          </div>
        </div>
      </div>
    );
  }

  const needsAddress = shippingChoice !== 'pickup';
  const canSave = lines.length > 0 && phone.trim() && name.trim().length >= 2 && (!needsAddress || address.line1.trim());

  return (
    <div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Orders</span>
          <h2>Record an order</h2>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -8, maxWidth: '62ch' }}>
        For an order that came in by phone, on WhatsApp, or across the counter. It is priced
        from your catalogue and counted in every report, the same as an order placed on the site.
      </p>

      <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
        <h4 style={{ marginTop: 0 }}>Who is it for</h4>
        <div className="field">
          <label>Phone number</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 90000 00000" inputMode="tel" />
          {phone.trim() && (
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              {match
                ? `Existing customer — ${match.name || 'no name on file'}. The order goes on their account.`
                : 'New to you — a customer record will be created so their orders stay together.'}
            </span>
          )}
        </div>
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="As they gave it" />
        </div>
        <div className="field">
          <label>Email <span className="muted">(optional — needed to email the invoice)</span></label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
        </div>
      </div>

      <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
        <h4 style={{ marginTop: 0 }}>What they want</h4>

        <div className="field">
          <label>Product</label>
          <select
            value={pick.productId}
            onChange={(e) => setPick({ productId: e.target.value, size: '', quantity: 1 })}
          >
            <option value="">Choose a product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {chosenProduct && (
          <div className="field">
            <label>Size</label>
            <select value={pick.size} onChange={(e) => setPick((v) => ({ ...v, size: e.target.value }))}>
              <option value="">Choose a size…</option>
              {(chosenProduct.sizes || []).map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label} — {money(s.price)}{Number(s.stock) > 0 ? '' : ' (no stock recorded)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {chosenSize && (
          <div className="flex gap-1" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ maxWidth: 110, marginBottom: 0 }}>
              <label>Quantity</label>
              <input
                type="number" min="1" value={pick.quantity}
                onChange={(e) => setPick((v) => ({ ...v, quantity: e.target.value }))}
              />
            </div>
            <button type="button" className="btn btn-outline" onClick={addLine}>Add to the order</button>
          </div>
        )}

        {lines.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 16, overflowX: 'auto' }}>
            <table className="admin-table admin-table-stack">
              <thead>
                <tr><th>Item</th><th>Qty</th><th style={{ textAlign: 'right' }}>Amount</th><th /></tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={`${l.productId}|${l.size}`}>
                    <td data-label="Item"><b>{l.name}</b><br /><span className="muted">{l.size} · {money(l.price)} each</span></td>
                    <td data-label="Qty">{l.quantity}</td>
                    <td data-label="Amount" style={{ textAlign: 'right' }}>{money(l.price * l.quantity)}</td>
                    <td>
                      <button
                        type="button" className="link-btn"
                        onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
        <h4 style={{ marginTop: 0 }}>Payment</h4>
        {PAYMENT.map((p) => (
          <label key={p.key} className="flex gap-1" style={{ alignItems: 'flex-start', marginBottom: 8, cursor: 'pointer' }}>
            <input
              type="radio" name="payment" value={p.key}
              checked={paymentMethod === p.key} onChange={() => setPaymentMethod(p.key)}
              style={{ marginTop: 4 }}
            />
            <span><b>{p.label}</b><br /><span className="muted" style={{ fontSize: '0.82rem' }}>{p.hint}</span></span>
          </label>
        ))}
      </div>

      <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
        <h4 style={{ marginTop: 0 }}>Delivery</h4>
        {DELIVERY.map((d) => (
          <label key={d.key} className="flex gap-1" style={{ alignItems: 'flex-start', marginBottom: 8, cursor: 'pointer' }}>
            <input
              type="radio" name="delivery" value={d.key}
              checked={shippingChoice === d.key} onChange={() => setShippingChoice(d.key)}
              style={{ marginTop: 4 }}
            />
            <span><b>{d.label}</b><br /><span className="muted" style={{ fontSize: '0.82rem' }}>{d.hint}</span></span>
          </label>
        ))}

        {needsAddress && (
          <div style={{ marginTop: 14 }}>
            <div className="field">
              <label>Address</label>
              <input value={address.line1} onChange={(e) => setAddress((a) => ({ ...a, line1: e.target.value }))} placeholder="House / street" />
            </div>
            <div className="field">
              <input value={address.line2} onChange={(e) => setAddress((a) => ({ ...a, line2: e.target.value }))} placeholder="Area / landmark (optional)" />
            </div>
            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: '1 1 150px' }}>
                <label>Town</label>
                <input value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} />
              </div>
              <div className="field" style={{ flex: '1 1 150px' }}>
                <label>State</label>
                <input value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))} />
              </div>
              <div className="field" style={{ flex: '1 1 110px' }}>
                <label>Pincode</label>
                <input value={address.pincode} onChange={(e) => setAddress((a) => ({ ...a, pincode: e.target.value }))} inputMode="numeric" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
        <h4 style={{ marginTop: 0 }}>Anything else</h4>
        <div className="field">
          <label>Coupon code <span className="muted">(optional)</span></label>
          <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="e.g. WESTERNGODS01" />
        </div>
        <div className="field">
          <label>Note <span className="muted">(optional — shown on the order)</span></label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Leave with the neighbour · wants it before Friday" />
        </div>
      </div>

      <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <b>Goods</b><b style={{ fontSize: '1.2rem' }}>{money(goods)}</b>
        </div>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
          {shippingChoice === 'shipping'
            ? 'Delivery is added when you save, at whatever your shipping settings say for this pincode.'
            : 'Nothing is added for delivery.'}
          {couponCode.trim() && ' The coupon is checked and applied on save.'}
          {' '}The final total is worked out from your catalogue by the server, not from this screen.
        </p>
        <div className="flex gap-1" style={{ marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-gold" disabled={!canSave || saving} onClick={save}>
            {saving ? 'Recording…' : 'Record the order'}
          </button>
          {!canSave && (
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              {lines.length === 0 ? 'Add at least one product.'
                : !phone.trim() ? 'A phone number is needed.'
                  : name.trim().length < 2 ? 'A name is needed.'
                    : 'A delivery address is needed unless they are collecting.'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
