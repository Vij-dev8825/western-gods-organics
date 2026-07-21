import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import logo from '../assets/logo.svg';
import { api } from '../api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useLang, LANGS } from '../i18n';
import { IconHeart, IconBag, IconUser, IconBell, IconMenu, IconBox, IconSearch } from './Icons';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { totalCount } = useCart();
  const { productIds } = useWishlist();
  const { isLoggedIn, user, token } = useAuth();
  const { lang, setLang, t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(location.pathname === '/shop' ? searchParams.get('search') || '' : '');

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?search=${encodeURIComponent(q)}` : '/shop');
    setOpen(false);
  }

  const links = [
    { to: '/', label: t('navHome') },
    { to: '/shop', label: t('navShop') },
    { to: '/categories', label: t('navCategories') },
    { to: '/combos', label: t('navCombos') },
    { to: '/blog', label: t('navBlog') },
    { to: '/contact', label: t('navContact') },
  ];

  // Poll unread notification count
  useEffect(() => {
    if (!token) {
      setUnread(0);
      return undefined;
    }
    let cancelled = false;
    const load = () =>
      api
        .getNotifications(token)
        .then((d) => !cancelled && setUnread(d.unread))
        .catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" aria-label="Western Gods Organics home">
          <img src={logo} alt="Western Gods Organics" height={52} />
        </NavLink>

        <form className="navbar-search" role="search" onSubmit={handleSearch}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label="Search products"
          />
          <button type="submit" aria-label="Search">
            <IconSearch />
          </button>
        </form>

        <nav className={`nav-links ${open ? 'open' : ''}`}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-icons">
          <select
            className="lang-select"
            aria-label="Language"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          {isLoggedIn && (
            <button className="icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              <IconBell />
              {unread > 0 && <span className="badge-count">{unread}</span>}
            </button>
          )}
          <button
            className={`icon-btn ${productIds.length > 0 ? 'wished' : ''}`}
            aria-label="Wishlist"
            onClick={() => navigate('/wishlist')}
          >
            <IconHeart filled={productIds.length > 0} />
            {productIds.length > 0 && <span className="badge-count">{productIds.length}</span>}
          </button>
          <button className="icon-btn" aria-label="Cart" onClick={() => navigate('/cart')}>
            <IconBag />
            {totalCount > 0 && <span className="badge-count">{totalCount}</span>}
          </button>
          {isLoggedIn && (
            <button className="icon-btn" aria-label="My Orders" onClick={() => navigate('/orders')}>
              <IconBox />
            </button>
          )}
          <button
            className={`icon-btn account-btn ${isLoggedIn ? 'has-initial' : ''}`}
            aria-label="Account"
            onClick={() => navigate(isLoggedIn ? '/profile' : '/login')}
          >
            {isLoggedIn && user?.name ? (
              <span className="avatar-initial">{user.name[0].toUpperCase()}</span>
            ) : (
              <IconUser />
            )}
          </button>
          <button className="mobile-toggle" aria-label="Toggle menu" onClick={() => setOpen((o) => !o)}>
            <IconMenu />
          </button>
        </div>
      </div>
    </header>
  );
}
