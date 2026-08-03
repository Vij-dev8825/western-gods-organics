import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getProductImage } from '../utils/productImages';
import ChakkiWheel from '../components/ChakkiWheel';

const EMPTY_PRODUCT = {
  name: '',
  category: '',
  shortDescription: '',
  description: '',
  image: '',
  sizes: [{ label: '', price: '', mrp: '', stock: '' }],
};

export default function Seller() {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [me, setMe] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [applyForm, setApplyForm] = useState({ businessName: '', phone: user?.phone || '', whatTheySell: '' });
  const [applying, setApplying] = useState(false);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [editingId, setEditingId] = useState(null); // null | 'new' | product id
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState(null);

  const [profileForm, setProfileForm] = useState(null); // null until loaded from /me
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [supportForm, setSupportForm] = useState({ subject: '', message: '' });
  const [sendingSupport, setSendingSupport] = useState(false);

  function loadMe() {
    api.seller.getMe(token).then(setMe).catch(() => setMe({ status: 'none' })).finally(() => setLoaded(true));
  }
  useEffect(loadMe, [token]);

  function loadProducts() {
    api.seller.getProducts(token).then((d) => setProducts(d.products)).catch(() => {});
  }
  function loadQuestions() {
    api.seller.getQuestions(token).then((d) => setQuestions(d.questions)).catch(() => {});
  }
  useEffect(() => {
    if (me?.status !== 'approved') return;
    loadProducts();
    loadQuestions();
    setProfileForm({ businessName: me.businessName || '', bio: me.bio || '', location: me.location || '', logo: me.logo || '' });
  }, [me?.status, token]);

  useEffect(() => {
    api.getCategories().then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  async function submitApplication(e) {
    e.preventDefault();
    setApplying(true);
    try {
      await api.seller.apply(token, applyForm);
      showToast("Application submitted! We'll review it shortly.");
      loadMe();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setApplying(false);
    }
  }

  function setSize(i, key, value) {
    setProductForm((f) => ({ ...f, sizes: f.sizes.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)) }));
  }

  function startNewProduct() {
    setProductForm({ ...EMPTY_PRODUCT, category: categories[0]?.slug || '' });
    setMessage(null);
    setEditingId('new');
  }

  function startEditProduct(p) {
    setProductForm({
      name: p.name,
      category: p.category,
      shortDescription: p.shortDescription,
      description: p.description,
      image: p.image,
      sizes: p.sizes.map((s) => ({ label: s.label, price: s.price, mrp: s.mrp, stock: s.stock })),
    });
    setMessage(null);
    setEditingId(p.id);
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploadingImage(true);
    try {
      const res = await api.seller.uploadImage(token, fd);
      setProductForm((f) => ({ ...f, image: res.url }));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingImage(false);
    }
  }

  async function saveProduct(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (editingId === 'new') {
        await api.seller.createProduct(token, productForm);
        setMessage({ type: 'success', text: 'Product submitted.' });
      } else {
        await api.seller.updateProduct(token, editingId, productForm);
        setMessage({ type: 'success', text: 'Product updated.' });
      }
      setEditingId(null);
      loadProducts();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p) {
    await api.seller.setProductActive(token, p.id, p.active === false).catch(() => {});
    loadProducts();
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setUploadingLogo(true);
    try {
      const res = await api.seller.uploadImage(token, fd);
      setProfileForm((f) => ({ ...f, logo: res.url }));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.seller.updateProfile(token, profileForm);
      showToast('Profile updated.');
      loadMe();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitAnswer(q) {
    const answer = (answerDrafts[q.id] || '').trim();
    if (answer.length < 2) {
      showToast('Enter an answer.', 'error');
      return;
    }
    try {
      await api.seller.answerQuestion(token, q.id, answer);
      setAnswerDrafts((d) => ({ ...d, [q.id]: '' }));
      loadQuestions();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function submitSupport(e) {
    e.preventDefault();
    setSendingSupport(true);
    try {
      await api.seller.submitSupport(token, supportForm);
      setSupportForm({ subject: '', message: '' });
      showToast("Message sent — we'll get back to you.");
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSendingSupport(false);
    }
  }

  if (!loaded) {
    return (
      <div className="center" style={{ padding: '120px 0' }}>
        <ChakkiWheel size={56} />
      </div>
    );
  }

  if (me.status === 'none' || me.status === 'rejected') {
    return (
      <div className="container section">
        <div className="breadcrumb">Home / Sell With Us</div>
        <h2>Sell With Us</h2>
        <p className="muted" style={{ marginBottom: 24, maxWidth: 640 }}>
          List your own oils, soaps or herbal products alongside ours — approved sellers keep the majority of
          every sale, paid out directly.
        </p>

        {me.status === 'rejected' && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            Your last application wasn't approved{me.reviewNote ? `: ${me.reviewNote}` : '.'} Feel free to apply again below.
          </div>
        )}

        <form className="form-card" onSubmit={submitApplication} style={{ maxWidth: 480 }}>
          <div className="field">
            <label>Business name</label>
            <input
              value={applyForm.businessName}
              onChange={(e) => setApplyForm((f) => ({ ...f, businessName: e.target.value }))}
              required
            />
          </div>
          <div className="field">
            <label>Contact phone</label>
            <input
              value={applyForm.phone}
              onChange={(e) => setApplyForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder={user?.phone}
            />
          </div>
          <div className="field">
            <label>What will you sell?</label>
            <textarea
              rows={3}
              value={applyForm.whatTheySell}
              onChange={(e) => setApplyForm((f) => ({ ...f, whatTheySell: e.target.value }))}
              placeholder="e.g. Handmade cold-pressed mustard oil from our family farm…"
              required
            />
          </div>
          <button className="btn btn-gold" disabled={applying}>{applying ? 'Submitting…' : 'Apply to sell'}</button>
        </form>
      </div>
    );
  }

  if (me.status === 'pending') {
    return (
      <div className="container section">
        <div className="breadcrumb">Home / Sell With Us</div>
        <h2>Sell With Us</h2>
        <div className="empty-state">
          <ChakkiWheel size={56} spin={false} />
          <h3>Application under review</h3>
          <p className="muted">
            Thanks for applying, {me.businessName}! We typically review new seller applications within a few
            business days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="breadcrumb">Home / Sell With Us</div>
      <h2>Sell With Us</h2>
      <p className="muted" style={{ marginBottom: 24 }}>
        Selling as <b>{me.businessName}</b> — you keep {100 - me.platformFeeRate}% of every sale, credited once
        the order is delivered.
      </p>

      {me.probationRemaining > 0 && (
        <div className="alert" style={{ marginBottom: 20 }}>
          Your first {me.probationRemaining} listing{me.probationRemaining === 1 ? '' : 's'} will be reviewed
          before going live — after that, your listings post instantly.
        </div>
      )}

      <div className="form-grid" style={{ marginBottom: 22 }}>
        <div className="form-card">
          <span className="muted" style={{ fontSize: '0.85rem' }}>Available balance</span>
          <h2 style={{ margin: '4px 0 0' }}>₹{me.balance}</h2>
        </div>
        <div className="form-card">
          <span className="muted" style={{ fontSize: '0.85rem' }}>Total earned</span>
          <h2 style={{ margin: '4px 0 0' }}>₹{me.totalEarned}</h2>
        </div>
        <div className="form-card">
          <span className="muted" style={{ fontSize: '0.85rem' }}>Total paid out</span>
          <h2 style={{ margin: '4px 0 0' }}>₹{me.totalPaid}</h2>
        </div>
      </div>

      {me.history.length > 0 && (
        <div className="form-card" style={{ marginBottom: 22 }}>
          <h3 style={{ marginTop: 0 }}>Earnings history</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr><th>Date</th><th>Activity</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
              </thead>
              <tbody>
                {me.history.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.createdAt).toLocaleDateString()}</td>
                    <td>{e.type === 'earn' ? `Sale — ${e.note}` : e.note}</td>
                    <td style={{ textAlign: 'right', color: e.amount > 0 ? 'var(--forest)' : 'inherit' }}>
                      {e.amount > 0 ? `+₹${e.amount}` : `−₹${Math.abs(e.amount)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {profileForm && (
        <form className="form-card" onSubmit={saveProfile} style={{ marginBottom: 22 }}>
          <div className="flex-between" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>My Storefront Profile</h3>
            <Link to={`/sellers/${user?.id}`} className="link-btn">View my public page →</Link>
          </div>
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: 0 }}>
            This is what shoppers see on your seller page and next to your products.
          </p>

          <div className="form-grid">
            <div className="field">
              <label>Business name</label>
              <input
                value={profileForm.businessName}
                onChange={(e) => setProfileForm((f) => ({ ...f, businessName: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>Where you're based</label>
              <input
                value={profileForm.location}
                onChange={(e) => setProfileForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Coimbatore, Tamil Nadu"
              />
            </div>
          </div>

          <div className="field">
            <label>Your story</label>
            <textarea
              rows={3}
              value={profileForm.bio}
              onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Tell shoppers who you are and how you make what you sell."
            />
          </div>

          <div className="field">
            <label>Logo or photo</label>
            {profileForm.logo && (
              <img
                src={getProductImage(profileForm.logo)}
                alt=""
                style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: '50%', marginBottom: 8, display: 'block' }}
              />
            )}
            <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
            {uploadingLogo && <span className="muted" style={{ fontSize: '0.8rem' }}>Uploading…</span>}
          </div>

          <button className="btn btn-gold btn-sm" disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      )}

      <div className="flex-between" style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>My Products</h3>
        {editingId === null && (
          <button type="button" className="btn btn-outline btn-sm" onClick={startNewProduct}>+ Add product</button>
        )}
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {editingId !== null && (
        <form className="form-card" onSubmit={saveProduct} style={{ marginBottom: 22 }}>
          <div className="form-grid">
            <div className="field">
              <label>Product name</label>
              <input value={productForm.name} onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="field">
              <label>Category</label>
              <select
                className="select"
                value={productForm.category}
                onChange={(e) => setProductForm((f) => ({ ...f, category: e.target.value }))}
                required
              >
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Photo</label>
            {productForm.image && (
              <img
                src={getProductImage(productForm.image)}
                alt=""
                style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, marginBottom: 8, display: 'block' }}
              />
            )}
            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
            {uploadingImage && <span className="muted" style={{ fontSize: '0.8rem' }}>Uploading…</span>}
          </div>

          <div className="field">
            <label>Short description</label>
            <input
              value={productForm.shortDescription}
              onChange={(e) => setProductForm((f) => ({ ...f, shortDescription: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Full description</label>
            <textarea
              rows={3}
              value={productForm.description}
              onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sizes, rates &amp; stock</label>
          <table className="admin-table sizes-editor">
            <thead>
              <tr><th>Size label</th><th>Price ₹</th><th>MRP ₹</th><th>Stock</th><th /></tr>
            </thead>
            <tbody>
              {productForm.sizes.map((s, i) => (
                <tr key={i}>
                  <td><input value={s.label} onChange={(e) => setSize(i, 'label', e.target.value)} required /></td>
                  <td><input type="number" min="0" value={s.price} onChange={(e) => setSize(i, 'price', e.target.value)} required /></td>
                  <td><input type="number" min="0" value={s.mrp} onChange={(e) => setSize(i, 'mrp', e.target.value)} /></td>
                  <td><input type="number" min="0" value={s.stock} onChange={(e) => setSize(i, 'stock', e.target.value)} /></td>
                  <td>
                    {productForm.sizes.length > 1 && (
                      <button
                        type="button"
                        className="link-btn danger"
                        onClick={() => setProductForm((f) => ({ ...f, sizes: f.sizes.filter((_, idx) => idx !== i) }))}
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
            onClick={() => setProductForm((f) => ({ ...f, sizes: [...f.sizes, { label: '', price: '', mrp: '', stock: '' }] }))}
          >
            + add size
          </button>

          <div className="flex gap-2" style={{ marginTop: 16 }}>
            <button className="btn btn-gold btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save product'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="admin-card">
        {products.length === 0 ? (
          <p className="muted">No products listed yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>Category</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.name}</b></td>
                  <td>{p.category}</td>
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
                    <button className="link-btn" onClick={() => startEditProduct(p)}>edit</button>
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

      <h3 style={{ marginTop: 28, marginBottom: 6 }}>
        Customer Questions{questions.filter((q) => !q.answer).length > 0 && ` (${questions.filter((q) => !q.answer).length} unanswered)`}
      </h3>
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: 0 }}>
        Shoppers asking about your products. Your answer appears publicly on that product's page.
      </p>
      <div className="admin-card">
        {questions.length === 0 ? (
          <p className="muted">No questions yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>Question</th><th>Asked</th><th>Answer</th></tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td><b>{q.productName}</b></td>
                  <td style={{ maxWidth: 220 }}>{q.question}</td>
                  <td className="muted">{new Date(q.createdAt).toLocaleDateString('en-IN')}</td>
                  <td style={{ minWidth: 260 }}>
                    {q.answer ? (
                      <>
                        <p style={{ margin: '0 0 4px' }}>{q.answer}</p>
                        <span className="muted" style={{ fontSize: '0.75rem' }}>
                          Answered {new Date(q.answeredAt).toLocaleDateString('en-IN')}
                        </span>
                      </>
                    ) : (
                      <div className="flex gap-1" style={{ alignItems: 'flex-start' }}>
                        <textarea
                          rows={2}
                          placeholder="Write an answer…"
                          value={answerDrafts[q.id] ?? ''}
                          onChange={(e) => setAnswerDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                          style={{ flex: 1 }}
                        />
                        <button className="link-btn" onClick={() => submitAnswer(q)}>Answer</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <form className="form-card" onSubmit={submitSupport} style={{ marginTop: 28 }}>
        <h3 style={{ marginTop: 0 }}>Need help? Message the team</h3>
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 0 }}>
          Questions about payouts, your fee rate, listings or anything else — we'll get back to you.
        </p>
        <div className="field">
          <label>Subject</label>
          <input
            value={supportForm.subject}
            onChange={(e) => setSupportForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="e.g. Question about my payout"
            required
          />
        </div>
        <div className="field">
          <label>Message</label>
          <textarea
            rows={3}
            value={supportForm.message}
            onChange={(e) => setSupportForm((f) => ({ ...f, message: e.target.value }))}
            required
          />
        </div>
        <button className="btn btn-outline btn-sm" disabled={sendingSupport}>
          {sendingSupport ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </div>
  );
}
