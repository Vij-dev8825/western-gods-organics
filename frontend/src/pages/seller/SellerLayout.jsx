import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, Navigate, useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import ChakkiWheel from '../../components/ChakkiWheel';
import { IconMenu } from '../../components/Icons';

const links = [
  { to: '/seller/dashboard', label: 'Dashboard', end: true },
  { to: '/seller/dashboard/products', label: 'My Products' },
  { to: '/seller/dashboard/questions', label: 'Customer Questions' },
  { to: '/seller/dashboard/profile', label: 'Storefront Profile' },
  { to: '/seller/dashboard/chat', label: 'Chat with Us' },
];

/** Child pages read the shared seller record (business name, balances,
 * probation) through this instead of each re-fetching /seller/me. */
export function useSeller() {
  return useOutletContext();
}

export default function SellerLayout() {
  const { user, loading, isLoggedIn, token } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [me, setMe] = useState(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [unread, setUnread] = useState(0);

  const reloadMe = useCallback(() => {
    if (!token) return;
    api.seller.getMe(token).then(setMe).catch(() => setMe(null)).finally(() => setMeLoaded(true));
  }, [token]);
  useEffect(reloadMe, [reloadMe]);

  // Same polling shape as AdminLayout's unread-chat badge.
  useEffect(() => {
    if (!token || me?.status !== 'approved') return undefined;
    let cancelled = false;
    const load = () =>
      api.seller.getChatUnread(token).then((d) => !cancelled && setUnread(d.unread)).catch(() => {});
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, me?.status]);

  if (loading || (isLoggedIn && !meLoaded)) {
    return (
      <div className="empty-state">
        <ChakkiWheel size={60} />
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (!isLoggedIn) return <Navigate to="/seller/login" replace />;
  // Logged in but not an approved seller — send them to the public apply
  // page rather than showing an empty portal.
  if (me?.status !== 'approved') return <Navigate to="/seller/register" replace />;

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">
            <img src="/favicon.svg" alt="" width={26} height={26} />
          </span>
          <div>
            <b className="gold-text">{me.businessName}</b>
            <span>Seller Portal</span>
          </div>
          <button
            type="button"
            className="admin-menu-toggle"
            aria-label="Toggle seller menu"
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
                {l.to === '/seller/dashboard/chat' && unread > 0 && <span className="badge-count static">{unread}</span>}
              </span>
            </NavLink>
          ))}
          <NavLink to={`/sellers/${user?.id}`} className="admin-back" onClick={() => setMenuOpen(false)}>
            View my public page →
          </NavLink>
          <NavLink to="/" className="admin-back" onClick={() => setMenuOpen(false)}>
            ← Back to store
          </NavLink>
        </nav>
      </aside>
      <main className="admin-content">
        <Outlet context={{ me, reloadMe }} />
      </main>
    </div>
  );
}
