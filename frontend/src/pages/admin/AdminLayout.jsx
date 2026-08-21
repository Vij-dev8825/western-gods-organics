import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import ChakkiWheel from '../../components/ChakkiWheel';
import RouteFallback from '../../components/RouteFallback';
import { IconMenu } from '../../components/Icons';

const links = [
  { to: '/admin/today', label: 'Today' },
  { to: '/admin/new-order', label: 'Record an Order' },
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/profit', label: 'Profit' },
  { to: '/admin/margins', label: 'Margins' },
  { to: '/admin/procurement', label: 'What to Buy' },
  { to: '/admin/activity', label: 'Activity log' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/coupons', label: 'Coupons' },
  { to: '/admin/gift-cards', label: 'Gift Cards' },
  { to: '/admin/affiliates', label: 'Affiliates' },
  { to: '/admin/sellers', label: 'Sellers' },
  { to: '/admin/subscriptions', label: 'Subscriptions' },
  { to: '/admin/banners', label: 'Home Banners' },
  { to: '/admin/page-banners', label: 'Page Banners' },
  { to: '/admin/sale-banner', label: 'Sale Banner' },
  { to: '/admin/announcements', label: 'Announcement Bar' },
  { to: '/admin/flowers', label: 'Flowers' },
  { to: '/admin/payment-methods', label: 'Payment Methods' },
  { to: '/admin/shipping', label: 'Domestic Shipping' },
  { to: '/admin/pressings', label: 'Scheduled Pressings' },
  { to: '/admin/festivals', label: 'Festival Calendar' },
  { to: '/admin/pookalam', label: 'Pookalam Contest' },
  { to: '/admin/trade', label: 'Trade & Wholesale' },
  { to: '/admin/share', label: 'Share & Promote' },
  { to: '/admin/invoice', label: 'Invoice Details' },
  { to: '/admin/countries', label: 'Countries & Currencies' },
  { to: '/admin/currency', label: 'Currency Rates' },
  { to: '/admin/homepage-reviews', label: 'Homepage Reviews' },
  { to: '/admin/blog', label: 'Blog' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/feedback', label: 'Feedback' },
  { to: '/admin/returns', label: 'Returns' },
  { to: '/admin/bottle-returns', label: 'Bottle Returns' },
  { to: '/admin/leads', label: 'Enquiries & Leads' },
  { to: '/admin/notify', label: 'Notifications' },
  { to: '/admin/whatsapp', label: 'WhatsApp' },
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
        {/* Own boundary so an admin page loading its own chunk suspends only
            this content area — the sidebar stays put instead of vanishing. */}
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
