import { useEffect } from 'react';
import { Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useLang } from './i18n';
import { CANONICAL_ORIGIN } from './utils/site';
import { captureAffiliateCode } from './utils/affiliateAttribution';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import ChatWidget from './components/ChatWidget';
import WhatsAppButton from './components/WhatsAppButton';
import AiAssistant from './components/AiAssistant';
import PromoPopup from './components/PromoPopup';
import CookieConsent from './components/CookieConsent';
import PushOptIn from './components/PushOptIn';
import InstallPrompt from './components/InstallPrompt';
import SaleCountdown from './components/SaleCountdown';
import WelcomeSelector from './components/WelcomeSelector';
import SeoMeta from './components/SeoMeta';

import Home from './pages/Home';
import Shop from './pages/Shop';
import Categories from './pages/Categories';
import Combos from './pages/Combos';
import Gifting from './pages/Gifting';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Orders from './pages/Orders';
import Subscriptions from './pages/Subscriptions';
import Rewards from './pages/Rewards';
import BatchPassport from './pages/BatchPassport';
import Finder from './pages/Finder';
import OrderSuccess from './pages/OrderSuccess';
import Notifications from './pages/Notifications';
import Invoice from './pages/Invoice';
import BulkEnquiry from './pages/BulkEnquiry';
import ContactUs from './pages/ContactUs';
import PrivacyPolicy from './pages/PrivacyPolicy';
import RefundPolicy from './pages/RefundPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import SustainabilityImpact from './pages/SustainabilityImpact';
import Sourcing from './pages/Sourcing';
import ImportInfo from './pages/ImportInfo';
import StoreLocator from './pages/StoreLocator';
import GiftCards from './pages/GiftCards';
import Affiliate from './pages/Affiliate';
import SellerLogin from './pages/SellerLogin';
import SellerPublicLayout from './pages/seller/SellerPublicLayout';
import SellerHome from './pages/seller/SellerHome';
import SellerRegister from './pages/seller/SellerRegister';
import SellerLayout from './pages/seller/SellerLayout';
import SellerDashboard from './pages/seller/SellerDashboard';
import SellerOrders from './pages/seller/SellerOrders';
import SellerProducts from './pages/seller/SellerProducts';
import SellerQuestions from './pages/seller/SellerQuestions';
import SellerProfile from './pages/seller/SellerProfile';
import SellerChat from './pages/seller/SellerChat';
import SellerStorefront from './pages/SellerStorefront';

import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCategories from './pages/admin/AdminCategories';
import AdminCoupons from './pages/admin/AdminCoupons';
import AdminSubscriptions from './pages/admin/AdminSubscriptions';
import AdminWhatsApp from './pages/admin/AdminWhatsApp';
import AdminBanners from './pages/admin/AdminBanners';
import AdminOrders from './pages/admin/AdminOrders';
import AdminReturns from './pages/admin/AdminReturns';
import AdminBottleReturns from './pages/admin/AdminBottleReturns';
import AdminLeads from './pages/admin/AdminLeads';
import AdminNotify from './pages/admin/AdminNotify';
import AdminChat from './pages/admin/AdminChat';
import AdminBlog from './pages/admin/AdminBlog';
import AdminPageBanners from './pages/admin/AdminPageBanners';
import AdminSaleBanner from './pages/admin/AdminSaleBanner';
import AdminPaymentMethods from './pages/admin/AdminPaymentMethods';
import AdminShipping from './pages/admin/AdminShipping';
import AdminCurrency from './pages/admin/AdminCurrency';
import AdminHomepageReviews from './pages/admin/AdminHomepageReviews';
import AdminCountries from './pages/admin/AdminCountries';
import AdminGiftCards from './pages/admin/AdminGiftCards';
import AdminAffiliates from './pages/admin/AdminAffiliates';
import AdminSellers from './pages/admin/AdminSellers';

function NotFound() {
  return (
    <div className="container" style={{ padding: '96px 0', textAlign: 'center' }}>
      <SeoMeta title="Page Not Found | Western Gods Organics" description="This page doesn't exist. Explore our cold-pressed oils, herbal soaps and powders." />
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
      <SaleCountdown />
      <div className="announce-bar">{t('announcement')}</div>
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
      <AiAssistant />
      <WhatsAppButton />
      <WelcomeSelector />
      <PromoPopup />
      <CookieConsent />
      <PushOptIn />
      <InstallPrompt />
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

// This is a client-rendered SPA on a single static index.html, so the
// canonical tag has to be updated per-route in JS rather than baked into
// the HTML — otherwise every page would claim the homepage as canonical
// and Google would drop the rest of the site from its index.
function CanonicalTag() {
  const { pathname } = useLocation();
  useEffect(() => {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', `${CANONICAL_ORIGIN}${pathname}`);
  }, [pathname]);
  return null;
}

export default function App() {
  useEffect(() => {
    captureAffiliateCode();
  }, []);
  return (
    <>
    <ScrollToTop />
    <CanonicalTag />
    <Routes>
      {/* Admin area: its own login page and dashboard shell, no store chrome */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Seller sign-in: same OTP auth as customers, its own branded entry point */}
      <Route path="/seller/login" element={<SellerLogin />} />

      {/* Public seller site — standalone marketing + signup, its own chrome,
          nothing shared with the customer storefront. */}
      <Route element={<SellerPublicLayout />}>
        <Route path="/seller" element={<SellerHome />} />
        <Route path="/seller/register" element={<SellerRegister />} />
      </Route>

      {/* Seller portal — guarded; SellerLayout bounces non-sellers to signup. */}
      <Route path="/seller/dashboard" element={<SellerLayout />}>
        <Route index element={<SellerDashboard />} />
        <Route path="orders" element={<SellerOrders />} />
        <Route path="products" element={<SellerProducts />} />
        <Route path="questions" element={<SellerQuestions />} />
        <Route path="profile" element={<SellerProfile />} />
        <Route path="chat" element={<SellerChat />} />
      </Route>

      {/* Old customer-site entry point — now just forwards to the seller site. */}
      <Route path="/sell-with-us" element={<Navigate to="/seller" replace />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="whatsapp" element={<AdminWhatsApp />} />
        <Route path="banners" element={<AdminBanners />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="returns" element={<AdminReturns />} />
        <Route path="bottle-returns" element={<AdminBottleReturns />} />
        <Route path="leads" element={<AdminLeads />} />
        <Route path="notify" element={<AdminNotify />} />
        <Route path="chat" element={<AdminChat />} />
        <Route path="blog" element={<AdminBlog />} />
        <Route path="page-banners" element={<AdminPageBanners />} />
        <Route path="sale-banner" element={<AdminSaleBanner />} />
        <Route path="payment-methods" element={<AdminPaymentMethods />} />
        <Route path="shipping" element={<AdminShipping />} />
        <Route path="currency" element={<AdminCurrency />} />
        <Route path="homepage-reviews" element={<AdminHomepageReviews />} />
        <Route path="countries" element={<AdminCountries />} />
        <Route path="gift-cards" element={<AdminGiftCards />} />
        <Route path="affiliates" element={<AdminAffiliates />} />
        <Route path="sellers" element={<AdminSellers />} />
      </Route>

      {/* Customer storefront */}
      <Route element={<StoreLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/combos" element={<Combos />} />
        <Route path="/gifting" element={<Gifting />} />
        <Route path="/sellers/:id" element={<SellerStorefront />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/guides" element={<Blog />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/batch/:batchNumber" element={<BatchPassport />} />
        <Route path="/finder" element={<Finder />} />
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
          path="/rewards"
          element={
            <ProtectedRoute>
              <Rewards />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gift-cards"
          element={
            <ProtectedRoute>
              <GiftCards />
            </ProtectedRoute>
          }
        />
        <Route
          path="/affiliate"
          element={
            <ProtectedRoute>
              <Affiliate />
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
        <Route path="/impact" element={<SustainabilityImpact />} />
        <Route path="/sourcing" element={<Sourcing />} />
        <Route path="/import" element={<ImportInfo />} />
        <Route path="/store-locator" element={<StoreLocator />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </>
  );
}
