import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Lightweight i18n: flat key → string dictionaries per language.
 * Missing keys fall back to English, so partial translations never break the UI.
 * Product names and descriptions can both be given per-language versions in the
 * admin's product form, falling back to English when one hasn't been entered —
 * see utils/productLocale.js for the lookup. Names are typed by hand and never
 * auto-translated: in Tamil Nadu the Tamil name for sesame oil is நல்லெண்ணெய்,
 * which is what people say and search for, not a rendering of the English.
 */

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
];

const en = {
  // announcement + nav
  announcement: '🚚 Free shipping above ₹899 · Cash on Delivery available · Pressed fresh every week',
  navHome: 'Home',
  navShop: 'Shop',
  navCategories: 'Categories',
  navCombos: 'Combos',
  navFinder: 'Finder',
  navBlog: 'Blog',
  navBulk: 'Bulk Sales',
  navContact: 'Contact',
  navAdmin: 'Admin',

  // hero
  heroEyebrow: 'Kachi Ghani · Wood-Pressed · Directly from Farmers',
  heroTitle: 'From our fields to your bottle',
  heroSub: 'No heat, no solvents, no shortcuts — just seeds, stone and a wooden ghani.',
  shopAllOils: 'Shop all products',
  enquireBulk: 'Enquire in bulk',
  statProducts: 'Organic products',
  statChemicals: 'Chemicals or additives',
  statTemp: 'Max pressing temperature',
  statTrace: 'Traceable to the farm',

  // USP strip
  usp1t: 'Farm-direct ingredients',
  usp1d: 'Sourced straight from partner farmers, sun-dried & hand-cleaned',
  usp2t: 'Wood-pressed (kachi ghani)',
  usp2d: 'Slow-crushed on a wooden kolhu, always under 25°C',
  usp3t: 'Lab-tested purity',
  usp3d: 'Every batch tested — zero chemicals, solvents or additives',
  usp4t: 'Made fresh weekly',
  usp4d: 'Small batches, batch-coded, shipped fresh to your door',

  // categories section
  catEyebrow: 'Shop by category',
  catTitle: 'Oils, soaps & powders — one promise',
  catSub: 'Everything is made in small batches from single-origin, farm-direct ingredients.',
  catTag: '100% Organic',
  catBrowse: 'Browse',
  catPageSub: 'Each product is single-origin and made in-house — nothing blended, nothing outsourced.',

  // bestsellers
  bestEyebrow: 'Bestsellers',
  bestTitle: 'Loved across kitchens',
  viewAll: 'View all products',

  // watch section
  watchEyebrow: "Watch how it's made",
  watchTitle: 'Slow by design, pure by tradition',
  watchDesc:
    'Watch our copra and seeds travel from the farm gate to the wooden ghani. The press turns slowly — under 25°C — so nothing burns, nothing oxidises, and every drop keeps its nutrients, aroma and colour.',
  watchLi1: 'Seeds sun-dried and hand-cleaned at the farm',
  watchLi2: 'Crushed on a traditional wooden kolhu, never refined',
  watchLi3: 'Settled naturally, cloth-filtered, batch-coded',
  watchCta: 'Taste the difference',

  // process
  processEyebrow: "How it's made",
  processTitle: 'From farm gate to your bottle',
  step1t: 'Sourcing',
  step1d: 'Seeds bought directly from partner farms, sun-dried and hand-cleaned.',
  step2t: 'Cold-pressing',
  step2d: 'Crushed slowly on a wooden ghani, kept under 25°C to protect nutrients.',
  step3t: 'Settling & filtering',
  step3d: 'Left to settle naturally, then cloth-filtered — no chemical clarifiers.',
  step4t: 'Bottling',
  step4d: 'Sealed the same week in food-grade bottles, batch-coded for traceability.',

  // testimonials + bulk
  testiEyebrow: 'What customers say',
  testiTitle: 'Trusted in thousands of kitchens',
  bulkTitle: 'Buying for a store, restaurant or event?',
  bulkDesc: 'We supply in bulk — 15L, 35L drums and custom quantities, with GST invoicing.',
  bulkCta: 'Get a wholesale quote',

  // shop page
  shopTitle: 'Shop',
  shopBannerSub: 'Cold-pressed oils, soaps and powders — traditionally made, honestly priced.',
  allProducts: 'All Products',
  searchPlaceholder: 'Search products…',
  searchResultsFor: 'Search results for',
  categoryFilter: 'Category',
  sortBy: 'Sort by',
  sortRecommended: 'Recommended',
  sortPriceAsc: 'Price: Low to High',
  sortPriceDesc: 'Price: High to Low',
  sortRating: 'Customer Rating',
  priceFilter: 'Price',
  priceUnder200: 'Under ₹200',
  price200to400: '₹200 – ₹400',
  price400to600: '₹400 – ₹600',
  priceAbove600: 'Above ₹600',
  newArrivalFilter: 'New Arrivals',
  newArrivalOnly: 'Show new arrivals only',
  blogBannerTitle: 'From the Ghani',
  blogBannerSub: 'Notes on traditional pressing, honest ingredients, and buying oil you can trust.',
  blogEmpty: 'No posts yet',
  blogEmptySub: "We're writing — check back soon.",
  blogNotFound: "This post doesn't exist or has been removed.",
  blogBackToAll: 'Back to all posts',
  shareLabel: 'Share',
  shareInstagramCopied: 'Link copied — paste it into your Instagram bio, DM, or story.',
  shareCopyFailed: "Couldn't copy the link — copy it from the address bar instead.",
  shareCopyLink: 'Copy link',
  shareLinkCopied: 'Link copied to clipboard.',
  commentsHeading: 'Comments',
  commentPlaceholder: 'Share your thoughts…',
  commentSubmit: 'Post comment',
  commentLoginPrompt: 'Log in to leave a comment',
  commentsEmpty: 'No comments yet — be the first.',
  productsCount: 'products',
  noMatch: 'No products match that search',
  noMatchSub: 'Try a different keyword or clear your filters.',

  // footer
  footerTagline:
    'Directly from farmers, traditional ways — wood-pressed (kachi ghani) oils, handmade soaps and stone-ground powders.',
  footerShop: 'Shop',
  footerSupport: 'Support',
  footerReach: 'Reach us',
  footerAll: 'All products',
  footerCategories: 'Categories',
  footerBulk: 'Bulk / Wholesale',
  footerVisitUs: 'Visit Us',
  footerSubscriptions: 'Subscribe & Save',
  footerWishlist: 'Wishlist',
  footerCart: 'Cart',
  footerOrders: 'My Orders',
  footerContact: 'Contact us',
  footerAccount: 'My account',
  footerRefunds: 'Refund & Returns',
  footerPrivacy: 'Privacy Policy',
  footerRights: 'All rights reserved.',
  footerCustomerService: 'Customer service',
  footerCallUs: 'Call us',
  footerWhatsapp: 'Chat on WhatsApp',
  footerAbout: 'About Us',
  footerAboutText:
    'A small family mill in Udumalpet, Tamil Nadu, making traditional wood-pressed (kachi ghani) oils, handmade soaps and stone-ground powders for over 60 years — in small weekly batches, traceable back to the farmers we source from.',
  footerProducts: 'Our Products',
  footerB2B: 'B2B',
  footerB2BText: 'Supplying restaurants, stores and events in bulk — 15L, 35L drums and custom quantities, with GST invoicing.',
  footerImport: 'Import to Your Country',
  footerSitemap: 'Site Map',
  footerLocation: 'Our Location',
  footerGetDirections: 'Get directions',
  welcomeSelectorTitle: 'Choose your language & country',
  welcomeSelectorSub: "Pick what works best for you — you can always change this later from the menu.",
  welcomeSelectorLangLabel: 'Language',
  welcomeSelectorRegionLabel: 'Country',
  welcomeSelectorConfirm: 'Continue',
  footerPolicy: 'Store Policy',
  footerTerms: 'Terms and Conditions',
  footerBackToTop: 'Back to top',
  footerMotto: 'Wood-pressed with care, always.',

  // cookie consent
  cookieMessage:
    'We use cookies to keep you signed in and remember your cart. With your permission we also count visits, so we can see which parts of the shop are useful. We never sell your data or use it for advertising.',
  cookieLearnMore: 'Learn more',
  cookieAcceptAll: 'Accept',
  cookieEssentialOnly: 'Only necessary',
  cookiePreferences: 'Preferences',
  cookiePrefTitle: 'Cookie preferences',
  cookiePrefNecessary: 'Necessary cookies',
  cookiePrefNecessaryDesc:
    'Required to keep you logged in and remember your cart and wishlist between visits. Always active.',
  cookiePrefAnalytics: 'Visit counting',
  cookiePrefAnalyticsDesc:
    'Google Analytics, so we can see how many people visit and which pages help them. Choose "Only necessary" and it is never loaded.',
  cookiePrefNote: 'We never sell your data, and we do not run advertising cookies.',
  cookiePrefSave: 'Accept both',

  // chat widget
  chatTitle: 'Chat with us',
  chatReply: 'We usually reply within a few hours',
  chatLoginText: 'Log in with your mobile number to start chatting with our team.',
  chatLoginBtn: 'Log in to chat',
  chatPlaceholder: 'Type a message…',
  chatSend: 'Send',
  chatGreeting: 'Namaste! 🙏 Ask us anything about our products, your order, or bulk pricing.',

  // seller portal — the path a new seller has to get through: signing up,
  // finding their way around, and putting the first item up. Sellers here are
  // often farmers and small makers, so keep the wording ordinary.
  sellNavDashboard: 'Dashboard',
  sellNavOrders: 'Orders',
  sellNavProducts: 'My Products',
  sellNavInsights: 'Insights',
  sellNavQuestions: 'Customer Questions',
  sellNavProfile: 'Storefront Profile',
  sellNavChat: 'Chat with Us',
  sellLogout: 'Log out',
  sellPortal: 'Seller Portal',
  sellLanguage: 'Language',

  sellRegName: "Your name, or your farm's name",
  sellRegNameHelp: "This is what shoppers see on your products. Your own name is perfectly fine — you don't need a company.",
  sellRegPhone: 'Phone we should call',
  sellRegWhat: 'What will you sell?',
  sellRegWhatHint: 'Tell us what you make, how you make it, and roughly how much you can supply.',
  sellRegLast: 'Last step — tell us who you are and what you make. No company, GST or licence needed to start.',

  sellQuickAdd: '+ Quick add',
  sellFullAdd: 'Add with all details',
  sellQuickTitle: 'Add something to sell',
  sellQuickHelp: 'Just the basics. You can add a longer description, more sizes and a video later by editing it.',
  sellQuickPhoto: 'A photo of it',
  sellQuickWhat: 'What is it?',
  sellQuickKind: 'What kind of thing is it?',
  sellQuickSize: 'What size?',
  sellQuickSizeOwn: 'or type your own',
  sellQuickPrice: 'Price for one (₹)',
  sellQuickStock: 'How many do you have?',
  sellQuickSubmit: 'Add it',
  sellQuickSaving: 'Adding…',
  sellCancel: 'Cancel',
  sellChoose: 'Choose…',
  sellAdded: "Added. We'll take it from here.",
};

/* The four non-English dictionaries are fetched when someone actually picks
 * that language, rather than shipped to everybody.
 *
 * All five used to live in this file: about 80 KB of source, the largest in
 * the codebase, and — because LanguageProvider wraps the whole app — part of
 * the chunk every single visitor downloads before seeing anything. Four fifths
 * of it was translations they had not asked for and would never read.
 *
 * English stays inline and is not lazy. It is what every other language falls
 * back to key by key, so it has to be present synchronously; loading it late
 * would mean rendering the raw key names for a frame. */
const loaders = {
  hi: () => import('./i18n/hi.js'),
  ta: () => import('./i18n/ta.js'),
  te: () => import('./i18n/te.js'),
  kn: () => import('./i18n/kn.js'),
};

const LangContext = createContext(null);

function isKnown(code) {
  return code === 'en' || Object.prototype.hasOwnProperty.call(loaders, code);
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem('yo_lang');
    return isKnown(saved) ? saved : 'en';
  });
  // English is here from the start; the rest arrive as they are chosen and
  // stay for the session, so switching back and forth costs one fetch each.
  const [dicts, setDicts] = useState({ en });

  useEffect(() => {
    let cancelled = false;
    if (lang !== 'en' && !dicts[lang] && loaders[lang]) {
      loaders[lang]()
        .then((mod) => {
          if (!cancelled) setDicts((prev) => ({ ...prev, [lang]: mod.default }));
        })
        .catch(() => {
          // The page stays in English rather than breaking. A failed chunk on
          // a bad connection should cost the translation, not the shop.
        });
    }
    return () => { cancelled = true; };
  }, [lang, dicts]);

  // Also syncs on first mount for a returning visitor's saved language, not
  // just on an active switch — search engines and screen readers read this
  // attribute, and it was previously left as the static index.html default.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(code) {
    if (!isKnown(code)) return;
    localStorage.setItem('yo_lang', code);
    setLangState(code);
  }

  // Falling through to English while a dictionary is still in flight is not a
  // new behaviour — it is exactly what already happened for any key a
  // translation was missing.
  function t(key) {
    return dicts[lang]?.[key] ?? en[key] ?? key;
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
