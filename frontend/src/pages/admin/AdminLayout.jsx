import { useEffect, useState } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import ChakkiWheel from '../../components/ChakkiWheel';
import { IconMenu } from '../../components/Icons';

const links = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/coupons', label: 'Coupons' },
  { to: '/admin/subscriptions', label: 'Subscriptions' },
  { to: '/admin/banners', label: 'Home Banners' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/leads', label: 'Enquiries & Leads' },
  { to: '/admin/notify', label: 'Notifications' },
  { to: '/admin/chat', label: 'Chat' },
];

export default function AdminLayout() {
  const { user, loading, isLoggedIn, token } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);

  // Poll the total unread customer-chat count across all conversations, so
  // the sidebar "Chat" link can show a badge without opening any thread
  // (opening a thread is what marks its messages read, server-side).
  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    const load = () =>
      api.admin
        .getConversations(token)
        .then((d) => !cancelled && setUnreadChats(d.conversations.reduce((sum, c) => sum + c.unread, 0)))
        .catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  if (loading) {
    return (
      <div className="empty-state">
        <ChakkiWheel size={60} />
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (!isLoggedIn || user?.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">
            <img src="/favicon.svg" alt="" width={26} height={26} />
          </span>
          <div>
            <b className="gold-text">Western Gods Organics</b>
            <span>Admin Panel</span>
          </div>
          <button
            type="button"
            className="admin-menu-toggle"
            aria-label="Toggle admin menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <IconMenu size={22} />
          </button>
        </div>
        <nav className={menuOpen ? 'open' : ''}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={() => setMenuOpen(false)}
            >
              <span className="admin-nav-label">
                {l.label}
                {l.to === '/admin/chat' && unreadChats > 0 && (
                  <span className="badge-count static">{unreadChats}</span>
                )}
              </span>
            </NavLink>
          ))}
          <NavLink to="/" className="admin-back" onClick={() => setMenuOpen(false)}>
            ← Back to store
          </NavLink>
        </nav>
      </aside>
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
