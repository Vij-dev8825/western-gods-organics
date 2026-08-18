import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback';
import { STORE_LOCATIONS } from '../../data/storeLocations';

const MILL = STORE_LOCATIONS[0];

/** Standalone chrome for the public-facing seller site (landing, register).
 * Deliberately shares nothing with the customer storefront's Navbar/Footer —
 * no cart, no shop nav, no currency/language switcher. This is a separate
 * destination for business owners, in the spirit of Amazon Seller Central. */
export default function SellerPublicLayout() {
  return (
    <div className="seller-site">
      <header className="seller-topbar">
        <Link to="/seller" className="seller-topbar-brand">
          <img src="/favicon.svg" alt="" width={30} height={30} />
          <span>
            <b>Western Gods Organics</b>
            <small>Seller Central</small>
          </span>
        </Link>
        <nav className="seller-topbar-nav">
          <NavLink to="/seller" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Why sell with us
          </NavLink>
          <Link to="/seller/login" className="btn btn-ghost btn-sm">Log in</Link>
          <Link to="/seller/register" className="btn btn-gold btn-sm">Start selling</Link>
        </nav>
      </header>

      <main className="seller-site-main">
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="seller-site-footer">
        <div>
          <b>Western Gods Organics — Seller Central</b>
          {/* Shared record, so this can't drift from the Business Profile. */}
          <p className="muted">
            {MILL.name}, {MILL.address}
          </p>
        </div>
        <div className="seller-site-footer-links">
          <Link to="/seller/register">Start selling</Link>
          <Link to="/seller/login">Seller login</Link>
          <a href="mailto:westerngodsorganic@gmail.com">Contact the team</a>
          <Link to="/">Go to the shop →</Link>
        </div>
      </footer>
    </div>
  );
}
