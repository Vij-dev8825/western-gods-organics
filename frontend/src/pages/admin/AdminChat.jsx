import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function AdminChat() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null); // userId
  const [thread, setThread] = useState({ customer: null, messages: [] });
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  // Poll conversation list
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api.admin.getConversations(token).then((d) => !cancelled && setConversations(d.conversations)).catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  // Poll selected thread
  useEffect(() => {
    if (!selected) return undefined;
    let cancelled = false;
    const load = () =>
      api.admin.getThread(token, selected).then((d) => !cancelled && setThread(d)).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages.length]);

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !selected) return;
    try {
      const d = await api.admin.sendMessage(token, selected, t);
      setThread((th) => ({ ...th, messages: [...th.messages, d.message] }));
      setText('');
    } catch {
      /* retry manually */
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Customer Chat</h1>
      </div>

      <div className="chat-console">
        <aside className="chat-list">
          {conversations.length === 0 && <p className="muted" style={{ padding: 16 }}>No conversations yet.</p>}
          {conversations.map((c) => (
            <button
              key={c.userId}
              className={`chat-list-item ${selected === c.userId ? 'active' : ''}`}
              onClick={() => setSelected(c.userId)}
            >
              <div className="flex-between">
                <b>{c.name}</b>
                {c.unread > 0 && <span className="badge-count static">{c.unread}</span>}
              </div>
              <span className="muted">{c.lastMessage.slice(0, 48)}</span>
            </button>
          ))}
        </aside>

        <section className="chat-thread">
          {!selected ? (
            <div className="chat-empty" style={{ margin: 'auto' }}>Select a conversation to reply.</div>
          ) : (
            <>
              <div className="chat-head">
                <div>
                  <b>{thread.customer?.name || 'Customer'}</b>
                  <span>{thread.customer?.phone}</span>
                </div>
              </div>
              <div className="chat-body">
                {thread.messages.map((m) => (
                  <div key={m.id} className={`chat-msg ${m.from === 'admin' ? 'mine' : 'theirs'}`}>
                    {m.text}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form className="chat-input" onSubmit={send}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply to the customer…" aria-label="Reply to the customer" />
                <button className="btn btn-gold btn-sm" disabled={!text.trim()}>Send</button>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}
