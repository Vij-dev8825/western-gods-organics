import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSeller } from './SellerLayout';

export default function SellerDashboard() {
  const { me, reloadMe } = useSeller();
  const { token } = useAuth();
  const { showToast } = useToast();
  const [pausing, setPausing] = useState(false);
  const [payout, setPayout] = useState({ request: null, minPayout: 500 });
  const [requesting, setRequesting] = useState(false);

  const checklist = me.checklist || [];
  const remaining = checklist.filter((c) => !c.done);

  useEffect(() => {
    if (!token) return;
    api.seller.getPayoutRequest(token).then(setPayout).catch(() => {});
  }, [token]);

  // Fetched rather than linked: the API authenticates with a bearer token, so
  // a plain <a download> would just get a 401 file.
  async function downloadStatement() {
    try {
      const res = await fetch('/api/seller/statement.csv', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Couldn't build your statement just now.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function requestPayout() {
    setRequesting(true);
    try {
      const res = await api.seller.requestPayout(token);
      setPayout((p) => ({ ...p, request: res.request }));
      showToast("Payout requested — we'll be in touch.");
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setRequesting(false);
    }
  }

  async function toggleVacation() {
    const turningOn = !me.onVacation;
    if (turningOn && !window.confirm('Pause your shop? Your listings come off the site until you switch this back on.')) return;
    setPausing(true);
    try {
      await api.seller.setVacation(token, turningOn);
      showToast(turningOn ? 'Your shop is paused.' : 'Your shop is live again.');
      reloadMe();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPausing(false);
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Dashboard</h1>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 20 }}>
        {me.sellerMode === 'marketplace' ? (
          <>
            You keep <b className="gold-text">{100 - me.platformFeeRate}%</b> of every sale, credited once the
            order is delivered.
          </>
        ) : (
          <>
            We sell your goods on our shop and pay you{' '}
            <b className="gold-text">{100 - me.platformFeeRate}%</b> of what each one sells for, once it
            reaches the customer. Your name goes on it as the maker.
          </>
        )}
      </p>

      {me.onVacation && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          <b>Your shop is paused.</b> None of your listings are on the site right now. Switch it back on below
          when you're ready to sell again.
        </div>
      )}

      {me.probationRemaining > 0 && (
        <div className="alert" style={{ marginBottom: 20 }}>
          Your first {me.probationRemaining} listing{me.probationRemaining === 1 ? '' : 's'} will be reviewed
          before going live — after that, your listings post instantly.
        </div>
      )}

      {remaining.length > 0 && (
        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>
            Finish setting up — {checklist.length - remaining.length} of {checklist.length} done
          </h3>
          <ul className="seller-checklist">
            {checklist.map((c) => (
              <li key={c.key} className={c.done ? 'done' : ''}>
                <span aria-hidden="true">{c.done ? '✓' : '○'}</span>
                {c.done ? c.label : <Link to={c.to}>{c.label}</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="stat-tiles">
        <Link to="/seller/dashboard/orders" className="stat-tile">
          <b className="gold-text">₹{me.balance}</b>
          <span>Available balance</span>
        </Link>
        <Link to="/seller/dashboard/orders" className="stat-tile">
          <b className="gold-text">₹{me.totalEarned}</b>
          <span>Total earned</span>
        </Link>
        <Link to="/seller/dashboard/orders" className="stat-tile">
          <b className="gold-text">₹{me.totalPaid}</b>
          <span>Total paid out</span>
        </Link>
      </div>

      <div className="admin-card">
        <h3>Earnings history</h3>
        {me.history.length === 0 ? (
          <p className="muted">
            No sales yet. Once an order containing one of your products is delivered, your share appears here.
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Date</th><th>Activity</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
            </thead>
            <tbody>
              {me.history.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>{e.type === 'earn' ? `Sale — ${e.note}` : e.type === 'reversal' ? `Reversed — ${e.note}` : e.note}</td>
                  <td style={{ textAlign: 'right', color: e.amount > 0 ? 'var(--forest)' : 'inherit' }}>
                    {e.amount > 0 ? `+₹${e.amount}` : `−₹${Math.abs(e.amount)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          {payout.request ? (
            <span className="pill warn">
              Payout of ₹{payout.request.amount} requested on{' '}
              {new Date(payout.request.createdAt).toLocaleDateString('en-IN')}
            </span>
          ) : (
            <button
              type="button"
              className="btn btn-gold btn-sm"
              disabled={requesting || me.balance < payout.minPayout}
              onClick={requestPayout}
              title={me.balance < payout.minPayout ? `Minimum payout is ₹${payout.minPayout}` : ''}
            >
              {requesting ? 'Requesting…' : 'Request a payout'}
            </button>
          )}
          <button type="button" className="btn btn-outline btn-sm" onClick={downloadStatement}>
            Download statement (CSV)
          </button>
        </div>
        <p className="muted" style={{ fontSize: '0.8rem', margin: '10px 0 0' }}>
          Payouts are made by bank transfer/UPI outside this app — your balance updates here once we've sent
          it. Minimum payout ₹{payout.minPayout}.
        </p>
      </div>

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>{me.onVacation ? 'Your shop is paused' : 'Going away?'}</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {me.onVacation
            ? 'Your listings are off the site. Turn this off and every one of them comes back exactly as you left it.'
            : 'Pausing takes all your listings off the site at once, without changing any of them. Your page, your story and your balance stay put.'}
        </p>
        <button
          type="button"
          className={me.onVacation ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
          disabled={pausing}
          onClick={toggleVacation}
        >
          {pausing ? 'Saving…' : me.onVacation ? 'Start selling again' : 'Pause my shop'}
        </button>
      </div>
    </>
  );
}
