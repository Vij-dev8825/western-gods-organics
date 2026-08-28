import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLang } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getProductImage } from '../../utils/productImages';

// Optional trust markers. The store fills these in for its own products and
// they drive the batch panel on the product page plus the public /batch
// passport a QR code points at — a seller's listing gets the same treatment.
const COMPLIANCE = ['batchNumber', 'productionDate', 'bestBeforeDate', 'fssaiLicense', 'inciIngredients', 'labReportUrl'];

const EMPTY_PRODUCT = {
  name: '',
  category: '',
  newCategory: '',
  shortDescription: '',
  description: '',
  image: '',
  video: '',
  sizes: [{ label: '', price: '', mrp: '', stock: '' }],
  ...Object.fromEntries(COMPLIANCE.map((f) => [f, ''])),
};

// Sentinel <option> value that swaps the dropdown for a free-text box.
const NEW_CATEGORY = '__new__';

export default function SellerProducts() {
  const { token } = useAuth();
  const { t } = useLang();
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [editingId, setEditingId] = useState(null); // null | 'new' | product id
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [message, setMessage] = useState(null);

  function load() {
    api.seller.getProducts(token).then((d) => setProducts(d.products)).catch(() => {});
  }
  useEffect(load, [token]);

  // The seller-scoped list, not the public one — it also includes categories
  // this seller proposed that are still awaiting review.
  function loadCategories() {
    api.seller.getCategories(token).then((d) => setCategories(d.categories)).catch(() => {});
  }
  useEffect(loadCategories, [token]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function setSize(i, key, value) {
    setForm((f) => ({ ...f, sizes: f.sizes.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)) }));
  }

  function startNew() {
    setForm({ ...EMPTY_PRODUCT, category: categories[0]?.slug || '' });
    setMessage(null);
    setEditingId('new');
  }

  // The short way in. Someone with one thing to sell and a phone in their hand
  // shouldn't have to read a form with fifteen fields to get started — this
  // asks only what a product genuinely can't exist without, and everything
  // else can be filled in later by editing the listing.
  function startQuick() {
    setForm({ ...EMPTY_PRODUCT, category: categories[0]?.slug || '' });
    setMessage(null);
    setEditingId('quick');
  }

  function startEdit(p) {
    setForm({
      name: p.name,
      category: p.category,
      newCategory: '',
      shortDescription: p.shortDescription,
      description: p.description,
      image: p.image,
      video: p.video || '',
      sizes: p.sizes.map((s) => ({ label: s.label, price: s.price, mrp: s.mrp, stock: s.stock })),
      ...Object.fromEntries(COMPLIANCE.map((f) => [f, p[f] || ''])),
    });
    setMessage(null);
    setEditingId(p.id);
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const res = await api.seller.uploadImage(token, fd);
      setForm((f) => ({ ...f, image: res.url }));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleVideoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploadingVideo(true);
    try {
      const res = await api.seller.uploadVideo(token, fd);
      setForm((f) => ({ ...f, video: res.url }));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingVideo(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    // The sentinel never reaches the server — the typed name goes as
    // `newCategory` and the backend resolves it to a slug.
    const addingCategory = form.category === NEW_CATEGORY;
    const payload = {
      ...form,
      category: addingCategory ? '' : form.category,
      newCategory: addingCategory ? form.newCategory : '',
    };
    try {
      if (editingId === 'new' || editingId === 'quick') {
        await api.seller.createProduct(token, payload);
        setMessage({ type: 'success', text: t('sellAdded') });
      } else {
        await api.seller.updateProduct(token, editingId, payload);
        setMessage({ type: 'success', text: 'Product updated.' });
      }
      setEditingId(null);
      load();
      if (addingCategory) loadCategories();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p) {
    await api.seller.setProductActive(token, p.id, p.active === false).catch(() => {});
    load();
  }

  return (
    <>
      <div className="admin-head">
        <h1>{t('sellNavProducts')}</h1>
        {editingId === null && (
          <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-gold btn-sm" onClick={startQuick}>{t('sellQuickAdd')}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={startNew}>{t('sellFullAdd')}</button>
          </div>
        )}
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {editingId === 'quick' && (
        <form className="admin-card" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>{t('sellQuickTitle')}</h3>
          <p className="muted" style={{ fontSize: '0.83rem', marginTop: 0 }}>{t('sellQuickHelp')}</p>

          <div className="field">
            <label htmlFor="quick-photo">{t('sellQuickPhoto')}</label>
            {form.image && (
              <img
                src={getProductImage(form.image)}
                alt=""
                style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8, display: 'block' }}
              />
            )}
            <input id="quick-photo" type="file" accept="image/*" capture="environment" onChange={handleImageUpload} disabled={uploading} />
            {uploading && <span className="muted" style={{ fontSize: '0.8rem' }}>Uploading…</span>}
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="quick-product-name">{t('sellQuickWhat')}</label>
              <input id="quick-product-name" value={form.name} onChange={set('name')} placeholder="e.g. Groundnut oil" required autoFocus />
            </div>
            <div className="field">
              <label htmlFor="quick-product-category">{t('sellQuickKind')}</label>
              <select id="quick-product-category" className="select" value={form.category} onChange={set('category')} required>
                <option value="">{t('sellChoose')}</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.label}{c.pending ? ' (awaiting review)' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="quick-product-size">{t('sellQuickSize')}</label>
            <div className="flex gap-1" style={{ flexWrap: 'wrap', marginBottom: 6 }}>
              {['250 ml', '500 ml', '1 L', '5 L', '250 g', '500 g', '1 kg'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`tab ${form.sizes[0].label === s ? 'active' : ''}`}
                  onClick={() => setSize(0, 'label', s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              id="quick-product-size"
              value={form.sizes[0].label}
              onChange={(e) => setSize(0, 'label', e.target.value)}
              placeholder={t('sellQuickSizeOwn')}
              required
            />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="quick-product-price">{t('sellQuickPrice')}</label>
              <input
                id="quick-product-price"
                type="number" min="0" inputMode="numeric"
                value={form.sizes[0].price}
                onChange={(e) => setSize(0, 'price', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="quick-product-stock">{t('sellQuickStock')}</label>
              <input
                id="quick-product-stock"
                type="number" min="0" inputMode="numeric"
                value={form.sizes[0].stock}
                onChange={(e) => setSize(0, 'stock', e.target.value)}
                placeholder="e.g. 20"
              />
            </div>
          </div>

          <div className="flex gap-2" style={{ marginTop: 16 }}>
            <button className="btn btn-gold btn-sm" disabled={saving || uploading}>
              {saving ? t('sellQuickSaving') : t('sellQuickSubmit')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>{t('sellCancel')}</button>
          </div>
        </form>
      )}

      {editingId !== null && editingId !== 'quick' && (
        <form className="admin-card" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>{editingId === 'new' ? 'Add a product' : 'Edit product'}</h3>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="product-name">{t('sellQuickWhat')}</label>
              <input id="product-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="field">
              <label htmlFor="product-category">Category</label>
              <select
                id="product-category"
                className="select"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                required
              >
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}{c.pending ? ' (awaiting review)' : ''}
                  </option>
                ))}
                <option value={NEW_CATEGORY}>+ Add a new category…</option>
              </select>
            </div>
          </div>

          {form.category === NEW_CATEGORY && (
            <div className="field">
              <label htmlFor="new-category-name">New category name</label>
              <input
                id="new-category-name"
                value={form.newCategory}
                onChange={(e) => setForm((f) => ({ ...f, newCategory: e.target.value }))}
                placeholder="e.g. Mustard Oil"
                maxLength={60}
                required
              />
              <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                Your product goes live as normal. The new category is reviewed before it appears in the
                shop's category menu — if one already exists under a similar name, we'll use that instead.
              </p>
            </div>
          )}

          <div className="field">
            <label htmlFor="product-photo">Photo</label>
            {form.image && (
              <img
                src={getProductImage(form.image)}
                alt=""
                style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, marginBottom: 8, display: 'block' }}
              />
            )}
            <input id="product-photo" type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
            {uploading && <span className="muted" style={{ fontSize: '0.8rem' }}>Uploading…</span>}
          </div>

          <div className="field">
            <label htmlFor="product-video">Video (optional)</label>
            {form.video && (
              <video
                src={getProductImage(form.video)}
                controls
                playsInline
                style={{ width: 220, borderRadius: 8, marginBottom: 8, display: 'block', background: '#000' }}
              />
            )}
            <div className="flex gap-1" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <input id="product-video" type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" onChange={handleVideoUpload} disabled={uploadingVideo} />
              {form.video && !uploadingVideo && (
                <button type="button" className="link-btn danger" onClick={() => setForm((f) => ({ ...f, video: '' }))}>
                  remove video
                </button>
              )}
            </div>
            <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
              {uploadingVideo
                ? 'Uploading and compressing — this can take a minute for a large clip…'
                : 'A short clip showing your product or how you make it. mp4, webm, ogg or mov, up to 60 MB.'}
            </p>
          </div>

          <div className="field">
            <label htmlFor="product-short-description">One line about it</label>
            <input
              id="product-short-description"
              value={form.shortDescription}
              onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="product-description">Tell people more (optional)</label>
            <textarea
              id="product-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sizes and price</label>
          <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 6px' }}>
            One row per size you sell. "Was ₹" is the old price if you want a crossed-out one shown — leave it
            empty otherwise.
          </p>
          <table className="admin-table sizes-editor">
            <thead>
              <tr><th>Size</th><th>Price ₹</th><th>Was ₹</th><th>How many</th><th /></tr>
            </thead>
            <tbody>
              {form.sizes.map((s, i) => (
                <tr key={i}>
                  <td><input aria-label="Size" value={s.label} onChange={(e) => setSize(i, 'label', e.target.value)} placeholder="500 ml" required /></td>
                  <td><input aria-label="Price" type="number" min="0" value={s.price} onChange={(e) => setSize(i, 'price', e.target.value)} required /></td>
                  <td><input aria-label="Was price (MRP)" type="number" min="0" value={s.mrp} onChange={(e) => setSize(i, 'mrp', e.target.value)} /></td>
                  <td><input aria-label="Stock quantity" type="number" min="0" value={s.stock} onChange={(e) => setSize(i, 'stock', e.target.value)} /></td>
                  <td>
                    {form.sizes.length > 1 && (
                      <button
                        type="button"
                        className="link-btn danger"
                        onClick={() => setForm((f) => ({ ...f, sizes: f.sizes.filter((_, idx) => idx !== i) }))}
                      >
                        remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="link-btn"
            onClick={() => setForm((f) => ({ ...f, sizes: [...f.sizes, { label: '', price: '', mrp: '', stock: '' }] }))}
          >
            + add size
          </button>

          <details style={{ marginTop: 18 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
              Batch &amp; sourcing details (optional)
            </summary>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 8 }}>
              Shoppers on this site care a lot about where things come from. Anything you fill in here shows in
              the "Batch &amp; product info" panel on your listing, credited to you, and a batch number gets its
              own scannable page you can print a QR code for.
            </p>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="product-batch-number">Batch number</label>
                <input id="product-batch-number" value={form.batchNumber} onChange={set('batchNumber')} placeholder="e.g. WG-2026-014" />
              </div>
              <div className="field">
                <label htmlFor="product-fssai-license">FSSAI licence on the pack</label>
                <input id="product-fssai-license" value={form.fssaiLicense} onChange={set('fssaiLicense')} placeholder="12345678901234" />
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="product-production-date">Made / pressed on</label>
                <input id="product-production-date" type="date" value={form.productionDate} onChange={set('productionDate')} />
              </div>
              <div className="field">
                <label htmlFor="product-best-before-date">Best before</label>
                <input id="product-best-before-date" type="date" value={form.bestBeforeDate} onChange={set('bestBeforeDate')} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="product-ingredients">Ingredients</label>
              <textarea id="product-ingredients" rows={2} value={form.inciIngredients} onChange={set('inciIngredients')}
                placeholder="Everything in the pack, in descending order by weight." />
            </div>
            <div className="field">
              <label htmlFor="product-lab-report-url">Lab report link</label>
              <input id="product-lab-report-url" value={form.labReportUrl} onChange={set('labReportUrl')} placeholder="https://…" />
              <p className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                A public link to a purity or test report, if you have one. Must be an http or https address.
              </p>
            </div>
          </details>

          <div className="flex gap-2" style={{ marginTop: 16 }}>
            <button className="btn btn-gold btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>{t('sellCancel')}</button>
          </div>
        </form>
      )}

      <div className="admin-card">
        {products.length === 0 ? (
          <p className="muted">No products listed yet — use "Add product" above to list your first one.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th /><th>Product</th><th>Category</th><th>Sizes · price · stock</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.image && <img className="thumb" src={getProductImage(p.image)} alt="" />}</td>
                  <td><b>{p.name}</b></td>
                  <td>{categories.find((c) => c.slug === p.category)?.label || p.category}</td>
                  <td>
                    {p.sizes.map((s) => (
                      <span className="pill" key={s.label}>{s.label} · ₹{s.price} · {s.stock} left</span>
                    ))}
                  </td>
                  <td>
                    {p.active === false ? (
                      <span className="muted">Deactivated</span>
                    ) : p.sellerModerationStatus === 'pending' ? (
                      <span className="pill warn">Pending review</span>
                    ) : (
                      <span className="pill status-placed">Live</span>
                    )}
                  </td>
                  <td>
                    <button className="link-btn" onClick={() => startEdit(p)}>edit</button>
                    <br />
                    <button className="link-btn danger" onClick={() => toggleActive(p)}>
                      {p.active === false ? 'reactivate' : 'deactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
