import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function SellerChat() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  // Poll on the same 15s cadence the admin console uses, so a reply lands
  // without the seller needing to reload.
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    const load = () =>
      api.seller.getChat(token).then((d) => !cancelled && setMessages(d.messages)).catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const res = await api.seller.sendChat(token, body);
      setMessages((m) => [...m, res.message]);
      setText('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Chat with Us</h1>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 20 }}>
        Questions about payouts, your listings, or anything else — message the Western Gods Organics team
        directly. We'll reply here and email you.
      </p>

      <div className="admin-card">
        <div style={{ maxHeight: 460, overflowY: 'auto', padding: '4px 2px', marginBottom: 14 }}>
          {messages.length === 0 ? (
            <p className="muted">No messages yet — say hello below.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: m.from === 'seller' ? 'flex-end' : 'flex-start',
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    maxWidth: '72%',
                    padding: '9px 13px',
                    borderRadius: 14,
                    background: m.from === 'seller' ? 'var(--forest)' : 'var(--cream-deep)',
                    color: m.from === 'seller' ? 'var(--paper)' : 'var(--ink)',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      opacity: 0.7,
                      marginTop: 4,
                      textAlign: m.from === 'seller' ? 'right' : 'left',
                    }}
                  >
                    {m.from === 'seller' ? 'You' : 'Western Gods Organics'} ·{' '}
                    {new Date(m.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex gap-1" style={{ alignItems: 'flex-start' }}>
          <textarea
            rows={2}
            placeholder="Type your message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn btn-gold btn-sm" disabled={sending || !text.trim()}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
    </>
  );
}
