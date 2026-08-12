import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

/** How long ago, in the plainest words. An order placed this morning reads
 *  "2h ago"; one from Tuesday reads "3 days ago" — because the second is a
 *  problem and the first isn't, and that difference should be visible without
 *  doing arithmetic on a timestamp. */
function ago(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** Anything older than this has been sitting too long and is marked, whatever
 *  it is. A customer who ordered two days ago and heard nothing doesn't care
 *  which queue their order is in. */
const STALE_HOURS = 24;
const isStale = (iso) => iso && Date.now() - new Date(iso).getTime() > STALE_HOURS * 3600_000;

/**
 * @param {{list: unknown[], total: number}} queue - the server sends the oldest
 *   few plus the true total; the heading always shows the total and any
 *   remainder is stated outright, so a trimmed list is never mistaken for the
 *   whole queue.
 */
function Group({ title, urgency = 'normal', queue, action, render }) {
  if (!queue.total) return null;
  const hidden = queue.total - queue.list.length;
  return (
    <section className={`today-group today-${urgency}`}>
      <div className="today-group-head">
        <h2>
          {title} <span className="today-count">{queue.total}</span>
        </h2>
        {action && <Link to={action.to} className="btn btn-outline btn-sm">{action.label}</Link>}
      </div>
      {queue.list.map(render)}
      {hidden > 0 && action && (
        <Link to={action.to} className="today-more">
          + {hidden} more →
        </Link>
      )}
    </section>
  );
}

function Row({ to, primary, secondary, meta, stale }) {
  return (
    <Link to={to} className={`today-row ${stale ? 'stale' : ''}`}>
      <div className="today-row-main">
        <b>{primary}</b>
        {secondary && <span className="muted">{secondary}</span>}
      </div>
      {meta && <span className="today-meta">{meta}</span>}
    </Link>
  );
}

/**
 * The one screen to open in the morning: everything currently waiting on a
 * person, and nothing else.
 *
 * The dashboard next door answers "how is the shop doing" and is worth reading
 * when you want to know. This answers "what do I have to do", which is a
 * different question with a different property — it can be finished. Every
 * item here can reach zero, and when they all do the page says so instead of
 * finding something to show.
 *
 * That rules out revenue, customer counts and totals, however encouraging.
 * A number that only goes up is not a task, and mixing the two is how a
 * to-do list quietly turns into a wall nobody reads.
 */
export default function Today() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.admin.today(token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  // Refreshed on an interval because this is a screen someone leaves open
  // while packing — an order that arrives at 11am should appear without
  // anyone thinking to reload.
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <p className="muted">Loading…</p>;

  const {
    toConfirm, toShip, inTransit, lowStock, waitingForStock,
    unansweredQuestions, newEnquiries, sellerApplications, payoutRequests,
    unreadChats, unreadSellerMessages,
  } = data;

  // Counted from the totals, not the trimmed lists, so the headline number is
  // the real amount of work rather than the amount currently on screen.
  const jobs =
    toConfirm.total + toShip.total + lowStock.total + waitingForStock.total +
    unansweredQuestions.total + newEnquiries.total + sellerApplications.total +
    payoutRequests.total + (unreadChats > 0 ? 1 : 0) + (unreadSellerMessages > 0 ? 1 : 0);

  const orderRow = (o) => (
    <Row
      key={o.id}
      to="/admin/orders"
      primary={`${o.orderNumber} · ₹${o.total}`}
      secondary={`${o.customer}${o.city ? `, ${o.city}` : ''} · ${o.itemCount} item${o.itemCount === 1 ? '' : 's'}`}
      meta={ago(o.createdAt)}
      stale={isStale(o.createdAt)}
    />
  );

  return (
    <>
      <div className="admin-head">
        <h1>Today</h1>
        {inTransit > 0 && (
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {inTransit} order{inTransit === 1 ? '' : 's'} on the way
          </span>
        )}
      </div>

      {jobs === 0 ? (
        <div className="today-clear">
          <div className="today-clear-mark">✓</div>
          <h2>Nothing needs you right now</h2>
          <p className="muted">
            No orders waiting, no questions unanswered, nothing running low.
            {inTransit > 0
              ? ` ${inTransit} order${inTransit === 1 ? ' is' : 's are'} already on the way.`
              : ''}
          </p>
        </div>
      ) : (
        <p className="muted today-lede">
          {jobs} thing{jobs === 1 ? '' : 's'} waiting. Oldest first.
        </p>
      )}

      <Group
        title="Confirm these orders"
        urgency="urgent"
        queue={toConfirm}
        action={{ to: '/admin/orders', label: 'All orders' }}
        render={orderRow}
      />

      <Group
        title="Pack and ship"
        urgency="urgent"
        queue={toShip}
        action={{ to: '/admin/orders', label: 'All orders' }}
        render={orderRow}
      />

      <Group
        title="Answer these questions"
        queue={unansweredQuestions}
        render={(q) => (
          <Row
            key={q.id}
            to={`/product/${q.productId}`}
            primary={q.text}
            secondary={q.productName}
            meta={ago(q.createdAt)}
            stale={isStale(q.createdAt)}
          />
        )}
      />

      <Group
        title="Back in stock — tell the people waiting"
        queue={waitingForStock}
        action={{ to: '/admin/notify', label: 'Notifications' }}
        render={(w) => (
          <Row
            key={`${w.productId}-${w.size}`}
            to="/admin/notify"
            primary={`${w.name} — ${w.size}`}
            secondary={`${w.people} ${w.people === 1 ? 'person' : 'people'} asked to be told`}
            meta={`${w.stock} in stock`}
          />
        )}
      />

      <Group
        title="Running low"
        urgency="warn"
        queue={lowStock}
        action={{ to: '/admin/products', label: 'Products' }}
        render={(l) => (
          <Row
            key={`${l.productId}-${l.size}`}
            to="/admin/products"
            primary={`${l.name} — ${l.size}`}
            meta={`${l.stock} left`}
            stale={l.stock === 0}
          />
        )}
      />

      <Group
        title="New bulk enquiries"
        queue={newEnquiries}
        action={{ to: '/admin/leads', label: 'All enquiries' }}
        render={(e) => (
          <Row
            key={e.id}
            to="/admin/leads"
            primary={e.name}
            secondary={`wants ${e.quantity} ${e.unit} ${e.productCategory}`}
          />
        )}
      />

      <Group
        title="Seller applications"
        queue={sellerApplications}
        action={{ to: '/admin/sellers', label: 'Sellers' }}
        render={(a) => (
          <Row key={a.id} to="/admin/sellers" primary={a.businessName} secondary={a.whatTheySell} />
        )}
      />

      <Group
        title="Payouts to send"
        urgency="warn"
        queue={payoutRequests}
        action={{ to: '/admin/sellers', label: 'Sellers' }}
        render={(r) => (
          <Row key={r.id} to="/admin/sellers" primary={r.businessName} meta={`₹${r.amount}`} />
        )}
      />

      {/* Deliberately not a Group: this is a fixed pair of links, not a queue
          that can overflow, so it needs neither a total nor a cap. */}

      {(unreadChats > 0 || unreadSellerMessages > 0) && (
        <section className="today-group">
          <div className="today-group-head">
            <h2>Messages</h2>
          </div>
          {unreadChats > 0 && (
            <Row
              to="/admin/chat"
              primary="Customer chat"
              secondary={`${unreadChats} unread message${unreadChats === 1 ? '' : 's'}`}
            />
          )}
          {unreadSellerMessages > 0 && (
            <Row
              to="/admin/sellers"
              primary="Seller messages"
              secondary={`${unreadSellerMessages} unread message${unreadSellerMessages === 1 ? '' : 's'}`}
            />
          )}
        </section>
      )}
    </>
  );
}
