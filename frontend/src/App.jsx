import { useEffect } from 'react';
import { Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { useLang } from './i18n';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import ChatWidget from './components/ChatWidget';
import PromoPopup from './components/PromoPopup';
import CookieConsent from './components/CookieConsent';

import Home from './pages/Home';
import Shop from './pages/Shop';
import Categories from './pages/Categories';
import Combos from './pages/Combos';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Orders from './pages/Orders';
import Subscriptions from './pages/Subscriptions';
import OrderSuccess from './pages/OrderSuccess';
import Notifications from './pages/Notifications';
import Invoice from './pages/Invoice';
import BulkEnquiry from './pages/BulkEnquiry';
import ContactUs from './pages/ContactUs';
import PrivacyPolicy from './pages/PrivacyPolicy';
import RefundPolicy from './pages/RefundPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import ImportInfo from './pages/ImportInfo';

import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCategories from './pages/admin/AdminCategories';
import AdminCoupons from './pages/admin/AdminCoupons';
import AdminSubscriptions from './pages/admin/AdminSubscriptions';
import AdminBanners from './pages/admin/AdminBanners';
import AdminOrders from './pages/admin/AdminOrders';
import AdminLeads from './pages/admin/AdminLeads';
import AdminNotify from './pages/admin/AdminNotify';
import AdminChat from './pages/admin/AdminChat';
import AdminBlog from './pages/admin/AdminBlog';

function NotFound() {
  return (
    <div className="container" style={{ padding: '96px 0', textAlign: 'center' }}>
      <h1 style={{ fontSize: '3rem' }}>404</h1>
      <p>This field hasn't been sown yet. The page you're looking for doesn't exist.</p>
      <a className="btn btn-gold" href="/">
        Back to Home
      </a>
    </div>
  );
}

// Customer-facing chrome (announcement bar, navbar, footer, chat widget).
// Kept entirely separate from the admin area, which has its own shell.
function StoreLayout() {
  const { t } = useLang();
  return (
    <div className="app-shell">
      <div className="announce-bar">{t('announcement')}</div>
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
      <PromoPopup />
      <CookieConsent />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
    <ScrollToTop />
    <Routes>
      {/* Admin area: its own login page and dashboard shell, no store chrome */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="banners" element={<AdminBanners />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="leads" element={<AdminLeads />} />
        <Route path="notify" element={<AdminNotify />} />
        <Route path="chat" element={<AdminChat />} />
        <Route path="blog" element={<AdminBlog />} />
      </Route>

      {/* Customer storefront */}
      <Route element={<StoreLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/combos" element={<Combos />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscriptions"
          element={
            <ProtectedRoute>
              <Subscriptions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-success/:orderId"
          element={
            <ProtectedRoute>
              <OrderSuccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoice/:orderId"
          element={
            <ProtectedRoute>
              <Invoice />
            </ProtectedRoute>
          }
        />
        <Route path="/bulk-enquiry" element={<BulkEnquiry />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/policy" element={<PrivacyPolicy />} />
        <Route path="/refund-policy" element={<RefundPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/import" element={<ImportInfo />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </>
  );
}
