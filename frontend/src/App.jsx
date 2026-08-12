import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useLang } from './i18n';
import { api } from './api';
import { CANONICAL_ORIGIN } from './utils/site';
import { captureAffiliateCode } from './utils/affiliateAttribution';
import { configureAnalytics, initAnalytics, trackPageView } from './utils/analytics';
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
import RouteFallback from './components/RouteFallback';
import TopProgressBar from './components/TopProgressBar';

// Home loads eagerly — it's where almost every first-time visitor lands, and
// there's no point trading a request waterfall for a saving nobody sees.
// Everything else is lazy: a shopper who only ever looks at the shop and
// checks out was, before this, also downloading the entire admin panel and
// the entire seller portal in the same bundle. Splitting per-route means the
// browser only fetches the one page actually being visited.
import Home from './pages/Home';
const Shop = lazy(() => import('./pages/Shop'));
const Categories = lazy(() => import('./pages/Categories'));
const Combos = lazy(() => import('./pages/Combos'));
const Gifting = lazy(() => import('./pages/Gifting'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Login = lazy(() => import('./pages/Login'));
const Profile = lazy(() => import('./pages/Profile'));
const Orders = lazy(() => import('./pages/Orders'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Rewards = lazy(() => import('./pages/Rewards'));
const BatchPassport = lazy(() => import('./pages/BatchPassport'));
const Finder = lazy(() => import('./pages/Finder'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Invoice = lazy(() => import('./pages/Invoice'));
const BulkEnquiry = lazy(() => import('./pages/BulkEnquiry'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const SustainabilityImpact = lazy(() => import('./pages/SustainabilityImpact'));
const Sourcing = lazy(() => import('./pages/Sourcing'));
const PressingCalendar = lazy(() => import('./pages/PressingCalendar'));
const ImportInfo = lazy(() => import('./pages/ImportInfo'));
const StoreLocator = lazy(() => import('./pages/StoreLocator'));
const GiftCards = lazy(() => import('./pages/GiftCards'));
const Affiliate = lazy(() => import('./pages/Affiliate'));
const SellerLogin = lazy(() => import('./pages/SellerLogin'));
const SellerPublicLayout = lazy(() => import('./pages/seller/SellerPublicLayout'));
const SellerHome = lazy(() => import('./pages/seller/SellerHome'));
const SellerRegister = lazy(() => import('./pages/seller/SellerRegister'));
const SellerLayout = lazy(() => import('./pages/seller/SellerLayout'));
const SellerDashboard = lazy(() => import('./pages/seller/SellerDashboard'));
const SellerOrders = lazy(() => import('./pages/seller/SellerOrders'));
const SellerInsights = lazy(() => import('./pages/seller/SellerInsights'));
const SellerProducts = lazy(() => import('./pages/seller/SellerProducts'));
const SellerQuestions = lazy(() => import('./pages/seller/SellerQuestions'));
const SellerProfile = lazy(() => import('./pages/seller/SellerProfile'));
const SellerChat = lazy(() => import('./pages/seller/SellerChat'));
const SellerStorefront = lazy(() => import('./pages/SellerStorefront'));
const SellerDirectory = lazy(() => import('./pages/SellerDirectory'));

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'));
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions'));
const AdminWhatsApp = lazy(() => import('./pages/admin/AdminWhatsApp'));
const AdminBanners = lazy(() => import('./pages/admin/AdminBanners'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminReturns = lazy(() => import('./pages/admin/AdminReturns'));
const AdminBottleReturns = lazy(() => import('./pages/admin/AdminBottleReturns'));
const AdminLeads = lazy(() => import('./pages/admin/AdminLeads'));
const AdminNotify = lazy(() => import('./pages/admin/AdminNotify'));
const AdminChat = lazy(() => import('./pages/admin/AdminChat'));
const AdminBlog = lazy(() => import('./pages/admin/AdminBlog'));
const AdminPageBanners = lazy(() => import('./pages/admin/AdminPageBanners'));
const AdminSaleBanner = lazy(() => import('./pages/admin/AdminSaleBanner'));
const AdminPaymentMethods = lazy(() => import('./pages/admin/AdminPaymentMethods'));
const AdminShipping = lazy(() => import('./pages/admin/AdminShipping'));
const AdminToday = lazy(() => import('./pages/admin/Today'));
const AdminPressings = lazy(() => import('./pages/admin/AdminPressings'));
const AdminShare = lazy(() => import('./pages/admin/AdminShare'));
const AdminInvoice = lazy(() => import('./pages/admin/AdminInvoice'));
const AdminCurrency = lazy(() => import('./pages/admin/AdminCurrency'));
const AdminHomepageReviews = lazy(() => import('./pages/admin/AdminHomepageReviews'));
const AdminCountries = lazy(() => import('./pages/admin/AdminCountries'));
const AdminGiftCards = lazy(() => import('./pages/admin/AdminGiftCards'));
const AdminAffiliates = lazy(() => import('./pages/admin/AdminAffiliates'));
const AdminSellers = lazy(() => import('./pages/admin/AdminSellers'));

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
        {/* Own Suspense boundary, not the app-wide one — a lazy page loading
            here suspends only this <Outlet>, so the navbar/footer/announce
            bar stay on screen instead of the whole shell blanking out. */}
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
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

// A route change in a single-page app fires no browser navigation, so nothing
// would ever be counted after the first page without this. initAnalytics is
// idempotent and refuses to load without both a measurement ID and consent,
// so calling it on every route is free and means a visitor who accepts
// mid-session starts being counted immediately.
function PageViewTracker() {
  const { pathname } = useLocation();

  // The GA measurement id and Meta pixel id live in the server's .env and
  // arrive with the rest of the public config, so they have to be fetched
  // before anything can be counted. Either may be absent — configureAnalytics
  // loads whichever is present. Failure is silent: measurement is never worth
  // an error in front of a shopper.
  useEffect(() => {
    api.getConfig()
      .then((d) => configureAnalytics({ gaMeasurementId: d.gaMeasurementId, metaPixelId: d.metaPixelId }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    initAnalytics();
    trackPageView(pathname);
  }, [pathname]);
  return null;
}

// This is a client-rendered SPA on a single static index.html, so the
// canonical tag has to be updated per-route in JS rather than baked into
// the HTML — otherwise every page would claim the homepage as canonical
// and Google would drop the rest of the site from its index.
function CanonicalTag() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    // Every other query param (sort, search, price, isNew…) genuinely should
    // canonicalize away — there's no reason for Google to treat "/shop
    // sorted by price" as a page distinct from "/shop". `category` is the one
    // exception: /shop?category=X is deliberately a real, separately-listed
    // entity (see sitemap.js and Shop.jsx's own per-category description) —
    // canonicalizing it down to bare /shop would tell Google to disregard
    // exactly the distinction the rest of that work depends on.
    const category = new URLSearchParams(search).get('category');
    const suffix = pathname === '/shop' && category && category !== 'all' ? `?category=${category}` : '';
    link.setAttribute('href', `${CANONICAL_ORIGIN}${pathname}${suffix}`);
  }, [pathname, search]);
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
    <PageViewTracker />
    <TopProgressBar />
    <Suspense fallback={<RouteFallback />}>
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
        <Route path="insights" element={<SellerInsights />} />
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
        <Route path="today" element={<AdminToday />} />
        <Route path="pressings" element={<AdminPressings />} />
        <Route path="share" element={<AdminShare />} />
        <Route path="invoice" element={<AdminInvoice />} />
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
        <Route path="/sellers" element={<SellerDirectory />} />
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
        <Route path="/pressings" element={<PressingCalendar />} />
        <Route path="/import" element={<ImportInfo />} />
        <Route path="/store-locator" element={<StoreLocator />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </Suspense>
    </>
  );
}
