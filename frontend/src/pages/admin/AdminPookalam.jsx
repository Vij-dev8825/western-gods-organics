/**
 * Judging the Onam pookalam contest.
 *
 * A queue, not a scoreboard: anything still waiting for a decision sits at the
 * top, and the tab you land on is whichever one has work in it. Entries are
 * pictures, so this is a card grid rather than the usual admin table — you
 * cannot judge a pookalam from a 40px thumbnail in a row.
 *
 * Nothing a customer submits appears on the storefront until it is approved
 * here. Awarding a prize also approves and crowns the entry, because a hidden
 * winner would make the public gallery contradict itself.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const when = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const TABS = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Posted' },
  { id: 'rejected', label: 'Not posted' },
  { id: 'all', label: 'Everything' },
];

/** A message the admin sends by hand. See the note on guest winners below. */
function waLink(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return `https://api.whatsapp.com/send?phone=${intl}&text=${encodeURIComponent(text)}`;
}

export default function AdminPookalam() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [entries, setEntries] = useState(null);
  const [tab, setTab] = useState('pending');
  const [busyId, setBusyId] = useState('');
  const [awarding, setAwarding] = useState('');

  /* The prize form, one at a time — only one entry is ever being awarded. */
  const [kind, setKind] = useState('coupon');
  const [type, setType] = useState('percent');
  const [value, setValue] = useState('15');
  const [minOrder, setMinOrder] = useState('0');
  const [expiresAt, setExpiresAt] = useState('');
  const [giftNote, setGiftNote] = useState('');

  const load = useCallback(() => {
    api.admin
      .listPookalamEntries(token)
      .then((d) => setEntries(d.entries || []))
      .catch((err) => showToast(err.message, 'error'));
  }, [token, showToast]);

  useEffect(load, [load]);

  const counts = useMemo(() => {
    const list = entries || [];
    return {
      pending: list.filter((e) => e.status === 'pending').length,
      approved: list.filter((e) => e.status === 'approved').length,
      rejected: list.filter((e) => e.status === 'rejected').length,
      all: list.length,
      winner: list.find((e) => e.winner) || null,
    };
  }, [entries]);

  /* Land on the tab that has something to do. */
  useEffect(() => {
    if (entries && counts.pending === 0 && tab === 'pending') setTab('approved');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const shown = useMemo(() => {
    const list = entries || [];
    return tab === 'all' ? list : list.filter((e) => e.status === tab);
  }, [entries, tab]);

  async function setStatus(id, status) {
    setBusyId(id);
    try {
      await api.admin.setPookalamStatus(token, id, status);
      showToast(status === 'approved' ? 'Posted to the gallery.' : 'Hidden from the gallery.');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId('');
    }
  }

  async function remove(id) {
    setBusyId(id);
    try {
      await api.admin.deletePookalamEntry(token, id);
      showToast('Entry deleted.');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId('');
    }
  }

  async function clearWinner(id) {
    setBusyId(id);
    try {
      await api.admin.clearPookalamWinner(token, id);
      showToast('No longer the winner. The coupon already issued still works.');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId('');
    }
  }

  async function award(entry) {
    setBusyId(entry.id);
    try {
      const res = await api.admin.awardPookalamPrize(token, entry.id, {
        kind,
        type,
        value: Number(value),
        minOrder: Number(minOrder) || 0,
        expiresAt: expiresAt || null,
        giftNote,
      });
      /* Say plainly whether the winner was actually told. A guest has no
         account to notify, and the WhatsApp sender is restricted to people who
         messaged the shop recently — so the honest answer is often "no". */
      if (res.notified?.inapp) {
        showToast('Winner set and told in the app.');
      } else {
        showToast('Winner set. Message them yourself — see the button on the card.');
      }
      setAwarding('');
      setGiftNote('');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusyId('');
    }
  }

  if (!entries) {
    return (
      <div>
        <div className="section-head">
          <div>
            <span className="eyebrow">Onam</span>
            <h2>Pookalam contest</h2>
          </div>
        </div>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-head">
        <div>
          <span className="eyebrow">Onam</span>
          <h2>Pookalam contest</h2>
        </div>
      </div>
      <p className="muted" style={{ marginTop: -8, maxWidth: '64ch' }}>
        Entries from the game at <b>/onam</b>. Nothing appears on the site until you
        post it here. Awarding a prize also posts and crowns that entry.
      </p>

      <div className="stat-grid" style={{ marginTop: 18 }}>
        <div className="stat-card">
          <span className="stat-label">Waiting for you</span>
          <b className="stat-value">{counts.pending}</b>
        </div>
        <div className="stat-card">
          <span className="stat-label">Posted</span>
          <b className="stat-value">{counts.approved}</b>
        </div>
        <div className="stat-card">
          <span className="stat-label">Entries</span>
          <b className="stat-value">{counts.all}</b>
        </div>
        <div className="stat-card">
          <span className="stat-label">Winner</span>
          <b className="stat-value" style={{ fontSize: counts.winner ? '1rem' : undefined }}>
            {counts.winner ? counts.winner.name : 'Not picked'}
          </b>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn btn-sm ${tab === t.id ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label} ({counts[t.id]})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="form-card" style={{ maxWidth: 620, marginTop: 18 }}>
          <p style={{ margin: 0 }}>Nothing here.</p>
          <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 0 }}>
            {counts.all === 0
              ? 'No one has entered yet. Entries arrive from the Finish tab of the game at /onam.'
              : 'Try another tab.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
            marginTop: 18,
          }}
        >
          {shown.map((e) => {
            const busy = busyId === e.id;
            const isAwarding = awarding === e.id;
            return (
              <div
                className="form-card"
                key={e.id}
                style={
                  e.winner
                    ? { borderColor: '#e4a52b', boxShadow: '0 0 0 2px rgba(228,165,43,0.25)' }
                    : undefined
                }
              >
                <a href={e.image} target="_blank" rel="noreferrer" title="Open full size">
                  <img
                    src={e.image}
                    alt={e.title || 'Pookalam entry'}
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      objectFit: 'cover',
                      borderRadius: 10,
                      background: '#fffdf6',
                    }}
                  />
                </a>

                <div style={{ marginTop: 10 }}>
                  <b style={{ display: 'block' }}>{e.title || 'Untitled'}</b>
                  <span className="muted" style={{ fontSize: '0.82rem' }}>
                    {e.name} · {e.phone}
                    {e.userId ? ' · has an account' : ' · guest'}
                  </span>
                  <div className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                    {e.blooms} flowers · {e.score} pts · {when(e.createdAt)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <span className={`pill${e.status === 'pending' ? ' pill-warn' : ''}`}>
                    {e.status}
                  </span>
                  {e.winner && <span className="pill">winner</span>}
                  {e.prize?.couponCode && <span className="pill">{e.prize.couponCode}</span>}
                  {e.prize?.giftNote && <span className="pill">gift</span>}
                </div>

                {e.prize?.giftNote && (
                  <p className="muted" style={{ fontSize: '0.82rem', marginTop: 8, marginBottom: 0 }}>
                    Send: {e.prize.giftNote}
                  </p>
                )}

                {/* A guest cannot be notified in-app and must not be cold-messaged
                    by the automatic sender, so the admin does it by hand. */}
                {e.winner && !e.notified?.inapp && (
                  <a
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: 10, display: 'inline-block' }}
                    href={waLink(
                      e.phone,
                      e.prize?.couponCode
                        ? `Onam ashamsakal ${e.name}! Your pookalam won our contest. Your code is ${e.prize.couponCode} — use it at westerngodsorganic.com`
                        : `Onam ashamsakal ${e.name}! Your pookalam won our contest. Your prize: ${e.prize?.giftNote || 'a gift from the mill'}.`
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Message the winner
                  </a>
                )}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                  {e.status !== 'approved' && (
                    <button
                      type="button"
                      className="btn btn-gold btn-sm"
                      disabled={busy}
                      onClick={() => setStatus(e.id, 'approved')}
                    >
                      {busy ? '…' : 'Post it'}
                    </button>
                  )}
                  {e.status !== 'rejected' && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={busy}
                      onClick={() => setStatus(e.id, 'rejected')}
                    >
                      Hide
                    </button>
                  )}
                  {e.winner ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={busy}
                      onClick={() => clearWinner(e.id)}
                    >
                      Not the winner
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={busy}
                      onClick={() => setAwarding(isAwarding ? '' : e.id)}
                    >
                      {isAwarding ? 'Cancel' : 'Give prize'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    onClick={() => remove(e.id)}
                  >
                    Delete
                  </button>
                </div>

                {isAwarding && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px solid rgba(31,61,43,0.12)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${kind === 'coupon' ? 'btn-gold' : 'btn-outline'}`}
                        onClick={() => setKind('coupon')}
                      >
                        Coupon
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${kind === 'gift' ? 'btn-gold' : 'btn-outline'}`}
                        onClick={() => setKind('gift')}
                      >
                        Gift
                      </button>
                    </div>

                    {kind === 'coupon' ? (
                      <>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                          <button
                            type="button"
                            className={`btn btn-sm ${type === 'percent' ? 'btn-gold' : 'btn-outline'}`}
                            onClick={() => setType('percent')}
                          >
                            % off
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${type === 'flat' ? 'btn-gold' : 'btn-outline'}`}
                            onClick={() => setType('flat')}
                          >
                            ₹ off
                          </button>
                        </div>
                        <label style={{ display: 'block', marginBottom: 8 }}>
                          <span className="muted" style={{ fontSize: '0.78rem' }}>
                            {type === 'percent' ? 'Percent off' : 'Rupees off'}
                          </span>
                          <input
                            type="number"
                            min="1"
                            value={value}
                            onChange={(ev) => setValue(ev.target.value)}
                          />
                        </label>
                        <label style={{ display: 'block', marginBottom: 8 }}>
                          <span className="muted" style={{ fontSize: '0.78rem' }}>
                            Minimum order (₹, 0 for none)
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={minOrder}
                            onChange={(ev) => setMinOrder(ev.target.value)}
                          />
                        </label>
                        <label style={{ display: 'block', marginBottom: 8 }}>
                          <span className="muted" style={{ fontSize: '0.78rem' }}>
                            Expires (optional)
                          </span>
                          <input
                            type="date"
                            value={expiresAt}
                            onChange={(ev) => setExpiresAt(ev.target.value)}
                          />
                        </label>
                        <p className="muted" style={{ fontSize: '0.76rem' }}>
                          A fresh single-use code is minted.{' '}
                          {e.userId
                            ? 'It will be locked to this customer’s account.'
                            : 'This entrant is a guest, so the code cannot be locked to an account — anyone holding it could use it once.'}
                        </p>
                      </>
                    ) : (
                      <label style={{ display: 'block', marginBottom: 8 }}>
                        <span className="muted" style={{ fontSize: '0.78rem' }}>
                          What are you sending?
                        </span>
                        <input
                          type="text"
                          maxLength={200}
                          placeholder="e.g. 1L cold-pressed sesame oil hamper"
                          value={giftNote}
                          onChange={(ev) => setGiftNote(ev.target.value)}
                        />
                      </label>
                    )}

                    <button
                      type="button"
                      className="btn btn-gold btn-sm"
                      disabled={busy}
                      onClick={() => award(e)}
                    >
                      {busy ? 'Saving…' : 'Make this the winner'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
