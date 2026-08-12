import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getProductImage } from '../../utils/productImages';
import ImageUploadField from '../../components/admin/ImageUploadField';
import { useCurrency } from '../../context/CurrencyContext';
import { LANGS } from '../../i18n';

const TRANSLATABLE_LANGS = LANGS.filter((l) => l.code !== 'en');

const EMPTY = {
  name: '',
  category: '',
  shortDescription: '',
  description: '',
  shortDescriptions: {},
  descriptions: {},
  image: '',
  extraImages: [],
  sizes: [{ label: '500 ml', price: '', mrp: '', stock: '', wholesalePrice: '' }],
  tags: '',
  comboItems: '',
  comboProductIds: [],
  isNew: false,
  earlyAccessUntil: '',
  countryPrices: {},
  batchNumber: '',
  productionDate: '',
  bestBeforeDate: '',
  growerName: '',
  growerVillage: '',
  fssaiLicense: '',
  inciIngredients: '',
  labReportUrl: '',
  marketPricePer100: '',
};

function toForm(p) {
  return {
    ...p,
    extraImages: (p.images || []).filter((img) => img && img !== p.image),
    tags: (p.tags || []).join(', '),
    comboItems: (p.comboItems || []).join(', '),
    comboProductIds: p.comboProductIds || [],
    earlyAccessUntil: p.earlyAccessUntil ? p.earlyAccessUntil.slice(0, 10) : '',
    countryPrices: p.countryPrices || {},
    shortDescriptions: p.shortDescriptions || {},
    descriptions: p.descriptions || {},
    batchNumber: p.batchNumber || '',
    productionDate: p.productionDate || '',
    bestBeforeDate: p.bestBeforeDate || '',
    growerName: p.growerName || '',
    growerVillage: p.growerVillage || '',
    fssaiLicense: p.fssaiLicense || '',
    inciIngredients: p.inciIngredients || '',
    labReportUrl: p.labReportUrl || '',
    marketPricePer100: p.marketPricePer100 ?? '',
  };
}

function normalizeCountryPrices(cp) {
  const out = {};
  for (const [code, sizes] of Object.entries(cp || {})) {
    const sizeOut = {};
    for (const [label, val] of Object.entries(sizes || {})) {
      const num = Number(val);
      if (val !== '' && val != null && Number.isFinite(num) && num > 0) sizeOut[label] = num;
    }
    if (Object.keys(sizeOut).length) out[code] = sizeOut;
  }
  return out;
}

function fromForm(f) {
  const { extraImages, ...rest } = f;
  return {
    ...rest,
    images: [f.image, ...extraImages].filter(Boolean),
    sizes: f.sizes.map((s) => ({
      label: s.label,
      price: Number(s.price),
      mrp: Number(s.mrp || s.price),
      stock: Number(s.stock || 0),
      wholesalePrice: s.wholesalePrice !== '' && s.wholesalePrice != null ? Number(s.wholesalePrice) : null,
    })),
    tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
    comboItems: f.comboItems.split(',').map((t) => t.trim()).filter(Boolean),
    countryPrices: normalizeCountryPrices(f.countryPrices),
    marketPricePer100: f.marketPricePer100 ? Number(f.marketPricePer100) : null,
  };
}

export default function AdminProducts() {
  const { token } = useAuth();
  const { countries } = useCurrency();
  const foreignCountries = countries.filter((c) => c.currency !== 'INR');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | product id
  const [form, setForm] = useState(EMPTY);
  const [notifyCustomers, setNotifyCustomers] = useState(true);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rates, setRates] = useState({});
  const [translating, setTranslating] = useState(false);
  const [bulkTranslating, setBulkTranslating] = useState(false);
  const formRef = useRef(null);

  function load() {
    api.getProducts({}, token).then((d) => setProducts(d.products)).catch(() => {});
    api.admin.getCategories(token).then((d) => setCategories(d.categories)).catch(() => {});
  }
  useEffect(load, [token]);

  /** Opens the printable QR sheet for a product's current batch.
   *
   * Fetched rather than linked because the PDF route needs an Authorization
   * header — see requestBlob in api.js. The object URL is released once the
   * new tab has had a moment to take it; holding every sheet in memory for the
   * life of the page would leak a megabyte at a time. */
  async function printBatchLabels(product) {
    const answer = window.prompt(
      `How many labels for batch ${product.batchNumber}?\n(18 fit on one A4 sheet)`,
      '18'
    );
    if (answer === null) return;
    const count = Number(answer);
    if (!Number.isFinite(count) || count < 1) {
      setMessage({ type: 'error', text: 'Enter a number of labels, e.g. 18.' });
      return;
    }
    try {
      const url = await api.admin.batchLabelsPdf(token, product.id, Math.round(count));
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }
  useEffect(() => {
    api.getCurrencyRates().then((d) => setRates(d.rates || {})).catch(() => {});
  }, []);
  // The edit form renders above the product table, so clicking "edit" on a
  // row further down the (potentially long) list leaves the newly-opened
  // form off-screen above the current scroll position — scroll it into view
  // instead of leaving the admin to hunt for it.
  useEffect(() => {
    if (editing) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editing]);

  function setCountryPrice(code, label, value) {
    setForm((f) => ({
      ...f,
      countryPrices: {
        ...f.countryPrices,
        [code]: { ...(f.countryPrices[code] || {}), [label]: value },
      },
    }));
  }

  function startNew() {
    setForm({ ...EMPTY, category: categories[0]?.id || '' });
    setEditing('new');
    setMessage(null);
  }

  function startEdit(p) {
    setForm(toForm(p));
    setEditing(p.id);
    setMessage(null);
  }

  function setSize(i, key, value) {
    setForm((f) => {
      const sizes = f.sizes.map((s, idx) => (idx === i ? { ...s, [key]: value } : s));
      return { ...f, sizes };
    });
  }

  function validate(f) {
    if (!f.sizes.length) return 'Add at least one size.';
    for (const s of f.sizes) {
      if (!s.label.trim()) return 'Every size needs a label.';
      if (!s.price || Number(s.price) <= 0) return `"${s.label}" needs a price greater than ₹0.`;
      if (s.mrp && Number(s.mrp) < Number(s.price)) return `"${s.label}"'s MRP can't be less than its price.`;
      if (s.stock && Number(s.stock) < 0) return `"${s.label}"'s stock can't be negative.`;
    }
    return null;
  }

  async function save(e) {
    e.preventDefault();
    const error = validate(form);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const payload = fromForm(form);
      if (editing === 'new') {
        await api.admin.createProduct(token, payload);
        setMessage({ type: 'success', text: 'Product created.' });
      } else {
        const res = await api.admin.updateProduct(token, editing, { ...payload, notifyCustomers });
        setMessage({
          type: 'success',
          text: res.notified
            ? `Product updated. Price-drop announced to ${res.notified.audience} customers (${res.notified.email} emails).`
            : 'Product updated.',
        });
      }
      setEditing(null);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function autoTranslate() {
    if (!form.name.trim()) {
      setMessage({ type: 'error', text: 'Add a product name first — translation needs it for context.' });
      return;
    }
    setTranslating(true);
    setMessage(null);
    try {
      const res = await api.admin.translateDescription(token, {
        name: form.name,
        shortDescription: form.shortDescription,
        description: form.description,
      });
      setForm((f) => ({
        ...f,
        shortDescriptions: { ...f.shortDescriptions, ...res.shortDescriptions },
        descriptions: { ...f.descriptions, ...res.descriptions },
      }));
      setMessage({ type: 'success', text: 'Translations filled in below — review, then Save product.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setTranslating(false);
    }
  }

  async function translateAll() {
    if (!window.confirm(
      "Auto-translate every product that's missing a Hindi/Tamil/Telugu/Kannada description, and save those translations immediately? Products that already have all 4 languages are left untouched."
    )) return;
    setBulkTranslating(true);
    setMessage(null);
    try {
      const res = await api.admin.translateAllProducts(token);
      setMessage({
        type: res.errors.length ? 'error' : 'success',
        text: `Translated ${res.translated} of ${res.total} product(s) needing it (${res.skipped} already complete).` +
          (res.errors.length ? ` Failed: ${res.errors.map((e) => e.name).join(', ')}.` : ''),
      });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBulkTranslating(false);
    }
  }

  async function del(p) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await api.admin.deleteProduct(token, p.id);
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Products</h1>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm" onClick={translateAll} disabled={bulkTranslating}>
            {bulkTranslating ? 'Translating all…' : '✨ Auto-translate all missing'}
          </button>
          <button className="btn btn-gold btn-sm" onClick={startNew}>+ Add product</button>
        </div>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {editing && (
        <form className="admin-card" onSubmit={save} ref={formRef}>
          <h3>{editing === 'new' ? 'New product' : `Edit: ${form.name}`}</h3>
          <div className="form-grid">
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tags (comma-separated)</label>
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
          </div>

          <ImageUploadField value={form.image} onChange={(url) => setForm({ ...form, image: url })} />

          <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginTop: 4 }}>
            Additional photos (gallery)
          </label>
          {form.extraImages.map((url, i) => (
            <div key={i} className="flex gap-1" style={{ alignItems: 'flex-end', marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <ImageUploadField
                  value={url}
                  onChange={(next) =>
                    setForm((f) => ({
                      ...f,
                      extraImages: f.extraImages.map((u, idx) => (idx === i ? next : u)),
                    }))
                  }
                />
              </div>
              <button
                type="button"
                className="link-btn danger"
                style={{ marginBottom: 14 }}
                onClick={() => setForm((f) => ({ ...f, extraImages: f.extraImages.filter((_, idx) => idx !== i) }))}
              >
                remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="link-btn"
            onClick={() => setForm((f) => ({ ...f, extraImages: [...f.extraImages, ''] }))}
          >
            + add another photo
          </button>

          <div className="field" style={{ marginTop: 16 }}>
            <label>Combo includes (comma-separated, optional)</label>
            <input
              value={form.comboItems}
              onChange={(e) => setForm({ ...form, comboItems: e.target.value })}
              placeholder="e.g. Coconut Oil 500ml, Castor Oil 500ml, Neem Soap"
            />
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
              Fill this in to sell this product as a combo/bundle — it'll show a "Combo" badge,
              list what's included, and appear on the dedicated Combos page.
            </p>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label>Kit contains these real products (optional)</label>
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: -4, marginBottom: 8 }}>
              Tick the actual catalog products bundled in this kit — each ticked product's own
              page will then show a "part of this kit" link back to this combo.
            </p>
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid rgba(31,61,43,0.15)', borderRadius: 8, padding: 10 }}>
              {products.filter((p) => p.id !== editing).map((p) => (
                <label key={p.id} className="flex gap-1" style={{ alignItems: 'center', fontWeight: 400, padding: '3px 0' }}>
                  <input
                    type="checkbox"
                    checked={form.comboProductIds.includes(p.id)}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      comboProductIds: e.target.checked
                        ? [...f.comboProductIds, p.id]
                        : f.comboProductIds.filter((id) => id !== p.id),
                    }))}
                  />
                  {' '}{p.name}
                </label>
              ))}
              {products.length === 0 && <p className="muted">No other products yet.</p>}
            </div>
          </div>

          <div className="field">
            <label>Short description (English)</label>
            <input value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} />
          </div>
          <div className="field">
            <label>Full description (English)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="flex gap-2" style={{ alignItems: 'baseline', marginTop: 16, flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Translations (optional)</label>
            <button type="button" className="link-btn" onClick={autoTranslate} disabled={translating}>
              {translating ? 'Translating…' : '✨ Auto-translate from English'}
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 10px' }}>
            Add a translated description so shoppers see it when they've selected that language.
            Leave a language blank and it'll fall back to the English text above.
          </p>
          {TRANSLATABLE_LANGS.map((l) => (
            <div key={l.code} className="form-grid" style={{ marginBottom: 8 }}>
              <div className="field">
                <label>Short description ({l.label})</label>
                <input
                  value={form.shortDescriptions[l.code] || ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      shortDescriptions: { ...f.shortDescriptions, [l.code]: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Full description ({l.label})</label>
                <textarea
                  value={form.descriptions[l.code] || ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      descriptions: { ...f.descriptions, [l.code]: e.target.value },
                    }))
                  }
                />
              </div>
            </div>
          ))}

          <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sizes, rates & stock</label>
          {/* Stacks on a phone too — this is where stock actually gets
              changed, and six input columns at 560px means typing into a box
              you can only half see. */}
          <table className="admin-table sizes-editor admin-table-stack">
            <thead>
              <tr><th>Size label</th><th>Price ₹</th><th>MRP ₹</th><th>Stock</th><th>Wholesale ₹ (optional)</th><th /></tr>
            </thead>
            <tbody>
              {form.sizes.map((s, i) => (
                <tr key={i}>
                  <td data-label="Size label"><input value={s.label} onChange={(e) => setSize(i, 'label', e.target.value)} required /></td>
                  <td data-label="Price ₹"><input type="number" min="0" value={s.price} onChange={(e) => setSize(i, 'price', e.target.value)} required /></td>
                  <td data-label="MRP ₹"><input type="number" min="0" value={s.mrp} onChange={(e) => setSize(i, 'mrp', e.target.value)} /></td>
                  <td data-label="Stock"><input type="number" min="0" value={s.stock} onChange={(e) => setSize(i, 'stock', e.target.value)} /></td>
                  <td data-label="Wholesale ₹ (optional)"><input type="number" min="0" value={s.wholesalePrice || ''} onChange={(e) => setSize(i, 'wholesalePrice', e.target.value)} placeholder="Same as price" /></td>
                  <td className="cell-action">
                    {form.sizes.length > 1 && (
                      <button type="button" className="link-btn danger" onClick={() => setForm((f) => ({ ...f, sizes: f.sizes.filter((_, idx) => idx !== i) }))}>
                        remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: -4 }}>
            Wholesale ₹ only applies to accounts flagged wholesale (Admin → Enquiries &amp; Leads → Customers) — leave
            blank to charge them the same price as everyone else.
          </p>
          <button
            type="button"
            className="link-btn"
            onClick={() => setForm((f) => ({ ...f, sizes: [...f.sizes, { label: '', price: '', mrp: '', stock: '', wholesalePrice: '' }] }))}
          >
            + add size
          </button>

          <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginTop: 20 }}>
            Country-wise price override (optional)
          </label>
          <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 10px' }}>
            Leave a cell blank to auto-convert from ₹ using the live exchange rate. Set a value to
            show shoppers browsing from that country a fixed price instead (e.g. round pricing
            like $4.99). Checkout always charges the ₹ price regardless.
          </p>
          <div style={{ overflowX: 'auto' }}>
            {/* A matrix — a column per size — so on a phone it becomes one
                card per country, each size a labelled field. The labels are
                the sizes themselves, which is why they come from the row
                rather than a fixed heading. */}
            <table className="admin-table sizes-editor admin-table-stack">
              <thead>
                <tr>
                  <th>Country</th>
                  {form.sizes.map((s, i) => (
                    <th key={i}>{s.label || `Size ${i + 1}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {foreignCountries.map((c) => (
                  <tr key={c.code}>
                    <td className="cell-rowhead">{c.label} ({c.currency})</td>
                    {form.sizes.map((s, i) => {
                      const label = s.label || `Size ${i + 1}`;
                      const value = form.countryPrices[c.code]?.[label] ?? '';
                      const auto = rates[c.currency] && s.price
                        ? `≈ ${c.symbol}${(Number(s.price) * rates[c.currency]).toFixed(2)}`
                        : c.symbol;
                      return (
                        <td key={i} data-label={label}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={value}
                            placeholder={auto}
                            onChange={(e) => setCountryPrice(c.code, label, e.target.value)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginTop: 20 }}>
            Batch, compliance &amp; pricing info (optional — shown on the product page when filled in)
          </label>
          <div className="form-grid">
            <div className="field">
              <label>Batch number</label>
              <input
                placeholder="e.g. WG-0347"
                value={form.batchNumber}
                onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Production date</label>
              <input
                type="date"
                value={form.productionDate}
                onChange={(e) => setForm({ ...form, productionDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Best before</label>
              <input
                type="date"
                value={form.bestBeforeDate}
                onChange={(e) => setForm({ ...form, bestBeforeDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Grown by</label>
              <input
                placeholder="e.g. Murugesan"
                value={form.growerName}
                onChange={(e) => setForm({ ...form, growerName: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Grower's village</label>
              <input
                placeholder="e.g. Kaniyur"
                value={form.growerVillage}
                onChange={(e) => setForm({ ...form, growerVillage: e.target.value })}
              />
            </div>
            <div className="field">
              <label>FSSAI license number</label>
              <input
                placeholder="e.g. 12345678901234"
                value={form.fssaiLicense}
                onChange={(e) => setForm({ ...form, fssaiLicense: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Lab report link (optional)</label>
              <input
                placeholder="https://…"
                value={form.labReportUrl}
                onChange={(e) => setForm({ ...form, labReportUrl: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Typical supermarket price, per 100ml/100g (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 45"
                value={form.marketPricePer100}
                onChange={(e) => setForm({ ...form, marketPricePer100: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Ingredients (INCI) — mainly for soaps</label>
            <textarea
              rows={2}
              placeholder="e.g. Saponified Coconut Oil, Saponified Palm Oil, Neem Oil, Tulsi Extract"
              value={form.inciIngredients}
              onChange={(e) => setForm({ ...form, inciIngredients: e.target.value })}
            />
          </div>

          <label className="check-row">
            <input type="checkbox" checked={form.isNew} onChange={(e) => setForm({ ...form, isNew: e.target.checked })} />
            Mark as New Arrival (shows a "New" badge and appears in the New Arrivals filter)
          </label>

          <div className="field" style={{ marginTop: 16, maxWidth: 260 }}>
            <label>Public launch date (optional)</label>
            <input
              type="date"
              value={form.earlyAccessUntil}
              onChange={(e) => setForm({ ...form, earlyAccessUntil: e.target.value })}
            />
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
              Leave blank to make this visible to everyone right away. Set a future date to hide
              it from Bronze customers and guests until then — Silver & Gold reward members can
              already see and buy it, as an early-access perk.
            </p>
          </div>

          {editing !== 'new' && (
            <label className="check-row">
              <input type="checkbox" checked={notifyCustomers} onChange={(e) => setNotifyCustomers(e.target.checked)} />
              Announce price drops to all customers (in-app + email)
            </label>
          )}

          <div className="flex gap-2" style={{ marginTop: 16 }}>
            <button className="btn btn-gold btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="admin-card">
        <table className="admin-table admin-table-stack">
          <thead>
            <tr><th /><th>Product</th><th>Category</th><th>Sizes · price · stock</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td className="cell-thumb"><img className="thumb" src={getProductImage(p.image)} alt="" /></td>
                <td data-label="Product">
                  <b>{p.name}</b>
                  {p.sellerId && <span className="pill" style={{ marginLeft: 6, fontSize: '0.7rem' }}>Seller listing</span>}
                </td>
                <td data-label="Category">{p.category}</td>
                <td data-label="Sizes · price · stock">
                  {p.sizes.map((s) => (
                    <span className="pill" key={s.label}>
                      {s.label} · ₹{s.price}{s.wholesalePrice > 0 ? ` (₹${s.wholesalePrice} wholesale)` : ''} · {s.stock} left
                    </span>
                  ))}
                </td>
                <td className="cell-action">
                  <button className="link-btn" onClick={() => startEdit(p)}>edit</button>{' '}
                  {/* Only where there's a batch to point a code at — a QR to a
                      passport page for a batch that doesn't exist would scan
                      straight to a 404 on the bottle in someone's hand. */}
                  {p.batchNumber && (
                    <>
                      <button className="link-btn" onClick={() => printBatchLabels(p)}>QR labels</button>{' '}
                    </>
                  )}
                  <button className="link-btn danger" onClick={() => del(p)}>delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
