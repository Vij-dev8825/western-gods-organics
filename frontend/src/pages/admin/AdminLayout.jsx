import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChakkiWheel from '../../components/ChakkiWheel';

const links = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/banners', label: 'Home Banners' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/leads', label: 'Enquiries & Leads' },
  { to: '/admin/notify', label: 'Notifications' },
  { to: '/admin/chat', label: 'Chat' },
];

export default function AdminLayout() {
  const { user, loading, isLoggedIn } = useAuth();

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
          <b>Yamuna Organic</b>
          <span>Admin Panel</span>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/" className="admin-back">← Back to store</NavLink>
      </aside>
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
