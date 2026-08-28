import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getProductImage } from '../../utils/productImages';
import ImageUploadField from '../../components/admin/ImageUploadField';

export default function AdminNotify() {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState('');
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState([]);
  const [channels, setChannels] = useState({ inapp: true, email: true, sms: false, push: true });
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState(null);
  const [sending, setSending] = useState(false);

  function load() {
    api.admin.notifyLogs(token).then((d) => setLogs(d.logs)).catch(() => {});
  }
  useEffect(load, [token]);
  useEffect(() => {
    api.getProducts().then((d) => setProducts(d.products)).catch(() => {});
  }, []);

  function productName(id) {
    return products.find((p) => p.id === id)?.name || null;
  }

  async function send(e) {
    e.preventDefault();
    if (!window.confirm('Send this notification to ALL customers on the selected channels?')) return;
    setSending(true);
    setMessage(null);
    try {
      const res = await api.admin.notify(token, { title, message: body, image, productId: productId || undefined, channels });
      setMessage({
        type: 'success',
        text: `Sent to ${res.counts.audience} customers — ${res.counts.inapp} in-app, ${res.counts.email} emails, ${res.counts.sms} SMS, ${res.counts.push || 0} push.`,
      });
      setTitle('');
      setBody('');
      setImage('');
      setProductId('');
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Customer Notifications</h1>
      </div>
      <p className="muted">
        Broadcast offers, price changes or stock updates to every customer. Email/SMS are logged to
        the server console until SMTP / SMS gateway credentials are set in the backend .env.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <form className="admin-card" onSubmit={send}>
        <h3>Compose broadcast</h3>
        <div className="field">
          <label htmlFor="notify-title">Title</label>
          <input id="notify-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Festive offer: 15% off sesame oil" required />
        </div>
        <div className="field">
          <label htmlFor="notify-message">Message</label>
          <textarea id="notify-message" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the message customers will receive…" required />
        </div>
        <ImageUploadField value={image} onChange={setImage} label="Image (optional)" />
        <div className="field">
          <label htmlFor="notify-product">Link to product (optional)</label>
          <select id="notify-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">No product — go to Notifications page</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>Tapping the notification will open this product's page.</p>
        </div>
        <div className="check-row-group">
          {[
            ['inapp', 'In-app notification'],
            ['email', 'Email'],
            ['sms', 'SMS'],
            ['push', 'Browser/OS push (customers who\'ve enabled it)'],
          ].map(([key, label]) => (
            <label className="check-row" key={key}>
              <input
                type="checkbox"
                checked={channels[key]}
                onChange={(e) => setChannels({ ...channels, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
        <button className="btn btn-gold btn-sm" disabled={sending}>
          {sending ? 'Sending…' : 'Send to all customers'}
        </button>
      </form>

      <div className="admin-card">
        <h3>Past broadcasts</h3>
        {logs.length === 0 ? (
          <p className="muted">Nothing sent yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Title</th><th>Channels</th><th>Delivered</th><th>When</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="flex gap-1" style={{ alignItems: 'flex-start' }}>
                      {l.image && <img src={getProductImage(l.image)} alt="" className="thumb" />}
                      <div>
                        <b>{l.title}</b>
                        <div className="muted" style={{ fontSize: '0.78rem', maxWidth: 320 }}>{l.message}</div>
                        {l.meta?.productId && productName(l.meta.productId) && (
                          <div className="muted" style={{ fontSize: '0.75rem' }}>→ {productName(l.meta.productId)}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{Object.entries(l.channels).filter(([, v]) => v).map(([k]) => k).join(', ')}</td>
                  <td>
                    {l.counts.inapp} in-app · {l.counts.email} email · {l.counts.sms} sms · {l.counts.push || 0} push
                  </td>
                  <td className="muted">{new Date(l.createdAt).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
