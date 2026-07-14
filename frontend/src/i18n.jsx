import { createContext, useContext, useState } from 'react';

/**
 * Lightweight i18n: flat key → string dictionaries per language.
 * Missing keys fall back to English, so partial translations never break the UI.
 * Product names/descriptions come from the database and stay as entered by the admin.
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
  announcement: '🚚 Free shipping above ₹499 · Cash on Delivery available · Pressed fresh every week',
  navHome: 'Home',
  navShop: 'Shop',
  navCategories: 'Categories',
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
  allProducts: 'All Products',
  searchPlaceholder: 'Search products…',
  categoryFilter: 'Category',
  sortBy: 'Sort by',
  sortRecommended: 'Recommended',
  sortPriceAsc: 'Price: Low to High',
  sortPriceDesc: 'Price: High to Low',
  sortRating: 'Customer Rating',
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
  footerWishlist: 'Wishlist',
  footerContact: 'Contact us',
  footerAccount: 'My account',
  footerRefunds: 'Refund & Returns',
  footerPrivacy: 'Privacy Policy',
  footerRights: 'All rights reserved.',
  footerMotto: 'Wood-pressed with care, always.',

  // chat widget
  chatTitle: 'Chat with us',
  chatReply: 'We usually reply within a few hours',
  chatLoginText: 'Log in with your mobile number to start chatting with our team.',
  chatLoginBtn: 'Log in to chat',
  chatPlaceholder: 'Type a message…',
  chatSend: 'Send',
  chatGreeting: 'Namaste! 🙏 Ask us anything about our products, your order, or bulk pricing.',
};

const hi = {
  announcement: '🚚 ₹499 से ऊपर मुफ़्त डिलीवरी · कैश ऑन डिलीवरी उपलब्ध · हर हफ़्ते ताज़ा पेराई',
  navHome: 'होम',
  navShop: 'दुकान',
  navCategories: 'श्रेणियाँ',
  navBulk: 'थोक बिक्री',
  navContact: 'संपर्क',
  navAdmin: 'एडमिन',

  heroEyebrow: 'कच्ची घानी · लकड़ी-पेराई · सीधे किसानों से',
  heroTitle: 'हमारे खेतों से आपकी बोतल तक',
  heroSub: 'न गर्मी, न केमिकल, न शॉर्टकट — सिर्फ़ बीज, पत्थर और लकड़ी की घानी।',
  shopAllOils: 'सभी उत्पाद देखें',
  enquireBulk: 'थोक पूछताछ करें',
  statProducts: 'ऑर्गेनिक उत्पाद',
  statChemicals: 'केमिकल या मिलावट',
  statTemp: 'अधिकतम पेराई तापमान',
  statTrace: 'खेत तक ट्रेस करने योग्य',

  usp1t: 'सीधे खेत से सामग्री',
  usp1d: 'साझेदार किसानों से सीधे ख़रीदे, धूप में सुखाए और हाथ से साफ़ किए',
  usp2t: 'लकड़ी की घानी (कच्ची घानी)',
  usp2d: 'लकड़ी के कोल्हू पर धीमी पेराई, हमेशा 25°C से नीचे',
  usp3t: 'लैब-परखी शुद्धता',
  usp3d: 'हर बैच की जाँच — शून्य केमिकल, सॉल्वेंट या मिलावट',
  usp4t: 'हर हफ़्ते ताज़ा',
  usp4d: 'छोटे बैच, बैच-कोडेड, आपके घर तक ताज़ा',

  catEyebrow: 'श्रेणी के अनुसार ख़रीदें',
  catTitle: 'तेल, साबुन और चूर्ण — एक ही वादा',
  catSub: 'सब कुछ छोटे बैच में, एकल-स्रोत, खेत से सीधी सामग्री से बनता है।',
  catTag: '100% ऑर्गेनिक',
  catBrowse: 'ब्राउज़ करें',
  catPageSub: 'हर उत्पाद एकल-स्रोत और अपने कारख़ाने में बना — न कोई मिश्रण, न कोई आउटसोर्सिंग।',

  bestEyebrow: 'बेस्टसेलर',
  bestTitle: 'हज़ारों रसोई की पसंद',
  viewAll: 'सभी उत्पाद देखें',

  watchEyebrow: 'देखें कैसे बनता है',
  watchTitle: 'धीमा तरीक़ा, शुद्ध परंपरा',
  watchDesc:
    'देखिए हमारा खोपरा और बीज खेत से लकड़ी की घानी तक कैसे पहुँचते हैं। घानी धीरे घूमती है — 25°C से नीचे — ताकि कुछ भी जले नहीं और हर बूँद में पोषण, ख़ुशबू और रंग बना रहे।',
  watchLi1: 'बीज खेत पर ही धूप में सुखाए और हाथ से साफ़ किए जाते हैं',
  watchLi2: 'पारंपरिक लकड़ी के कोल्हू पर पेराई, कभी रिफाइंड नहीं',
  watchLi3: 'प्राकृतिक रूप से ठहराव, कपड़े से छानना, बैच-कोडिंग',
  watchCta: 'फ़र्क़ चखकर देखें',

  processEyebrow: 'कैसे बनता है',
  processTitle: 'खेत से आपकी बोतल तक',
  step1t: 'सोर्सिंग',
  step1d: 'बीज सीधे साझेदार खेतों से, धूप में सुखाए और हाथ से साफ़।',
  step2t: 'कोल्ड-प्रेसिंग',
  step2d: 'लकड़ी की घानी पर धीमी पेराई, पोषण बचाने के लिए 25°C से नीचे।',
  step3t: 'ठहराव और छनाई',
  step3d: 'प्राकृतिक ठहराव, फिर कपड़े से छनाई — कोई केमिकल नहीं।',
  step4t: 'बोतल-बंदी',
  step4d: 'उसी हफ़्ते फ़ूड-ग्रेड बोतलों में सील, ट्रेसबिलिटी के लिए बैच-कोड।',

  testiEyebrow: 'ग्राहक क्या कहते हैं',
  testiTitle: 'हज़ारों रसोई का भरोसा',
  bulkTitle: 'दुकान, रेस्टोरेंट या आयोजन के लिए ख़रीदना है?',
  bulkDesc: 'हम थोक में देते हैं — 15L, 35L ड्रम और कस्टम मात्रा, GST बिल के साथ।',
  bulkCta: 'थोक भाव पाएँ',

  shopTitle: 'दुकान',
  allProducts: 'सभी उत्पाद',
  searchPlaceholder: 'उत्पाद खोजें…',
  categoryFilter: 'श्रेणी',
  sortBy: 'क्रमबद्ध करें',
  sortRecommended: 'अनुशंसित',
  sortPriceAsc: 'क़ीमत: कम से ज़्यादा',
  sortPriceDesc: 'क़ीमत: ज़्यादा से कम',
  sortRating: 'ग्राहक रेटिंग',
  productsCount: 'उत्पाद',
  noMatch: 'इस खोज से कोई उत्पाद नहीं मिला',
  noMatchSub: 'कोई और शब्द आज़माएँ या फ़िल्टर हटाएँ।',

  footerTagline:
    'सीधे किसानों से, पारंपरिक तरीक़े — लकड़ी-पेराई (कच्ची घानी) तेल, हाथ के बने साबुन और सिल-पिसे चूर्ण।',
  footerShop: 'दुकान',
  footerSupport: 'सहायता',
  footerReach: 'संपर्क करें',
  footerAll: 'सभी उत्पाद',
  footerCategories: 'श्रेणियाँ',
  footerBulk: 'थोक / होलसेल',
  footerWishlist: 'विशलिस्ट',
  footerContact: 'संपर्क करें',
  footerAccount: 'मेरा खाता',
  footerRefunds: 'रिफ़ंड और वापसी',
  footerPrivacy: 'गोपनीयता नीति',
  footerRights: 'सर्वाधिकार सुरक्षित।',
  footerMotto: 'हमेशा, प्यार से लकड़ी-पेराई।',

  chatTitle: 'हमसे बात करें',
  chatReply: 'हम आमतौर पर कुछ घंटों में जवाब देते हैं',
  chatLoginText: 'हमारी टीम से चैट शुरू करने के लिए अपने मोबाइल नंबर से लॉग इन करें।',
  chatLoginBtn: 'चैट के लिए लॉग इन करें',
  chatPlaceholder: 'संदेश लिखें…',
  chatSend: 'भेजें',
  chatGreeting: 'नमस्ते! 🙏 हमारे उत्पाद, आपके ऑर्डर या थोक भाव — कुछ भी पूछिए।',
};

const ta = {
  announcement: '🚚 ₹499க்கு மேல் இலவச டெலிவரி · கேஷ் ஆன் டெலிவரி உண்டு · வாரந்தோறும் புதிதாக ஆட்டப்படுகிறது',
  navHome: 'முகப்பு',
  navShop: 'கடை',
  navCategories: 'வகைகள்',
  navBulk: 'மொத்த விற்பனை',
  navContact: 'தொடர்பு',
  navAdmin: 'நிர்வாகம்',

  heroEyebrow: 'மரச்செக்கு · செக்கில் ஆட்டியது · நேரடியாக விவசாயிகளிடமிருந்து',
  heroTitle: 'எங்கள் வயலிலிருந்து உங்கள் பாட்டிலுக்கு',
  heroSub: 'வெப்பம் இல்லை, ரசாயனம் இல்லை, குறுக்குவழி இல்லை — விதை, கல், மரச்செக்கு மட்டுமே.',
  shopAllOils: 'அனைத்து பொருட்களும்',
  enquireBulk: 'மொத்த விலை விசாரிக்க',
  statProducts: 'இயற்கை பொருட்கள்',
  statChemicals: 'ரசாயனம் / கலப்படம்',
  statTemp: 'அதிகபட்ச ஆட்டும் வெப்பநிலை',
  statTrace: 'பண்ணை வரை தடமறியலாம்',

  usp1t: 'பண்ணையிலிருந்து நேரடி மூலப்பொருள்',
  usp1d: 'கூட்டு விவசாயிகளிடமிருந்து நேரடியாக — வெயிலில் உலர்த்தி கையால் சுத்தம்',
  usp2t: 'மரச்செக்கு முறை',
  usp2d: 'மரச்செக்கில் மெதுவாக ஆட்டப்படுகிறது, எப்போதும் 25°Cக்குக் கீழ்',
  usp3t: 'ஆய்வக சோதனை தூய்மை',
  usp3d: 'ஒவ்வொரு தொகுப்பும் சோதிக்கப்படுகிறது — ரசாயனம், கலப்படம் ஏதுமில்லை',
  usp4t: 'வாரந்தோறும் புதிது',
  usp4d: 'சிறு தொகுப்புகள், தொகுப்பு-குறியீடு, வீட்டுக்கு புதிதாக அனுப்பம்',

  catEyebrow: 'வகை வாரியாக வாங்குங்கள்',
  catTitle: 'எண்ணெய், சோப்பு, பொடி — ஒரே வாக்குறுதி',
  catSub: 'அனைத்தும் சிறு தொகுப்புகளில், ஒற்றை மூலம், பண்ணை நேரடி மூலப்பொருட்களில் தயாராகிறது.',
  catTag: '100% இயற்கை',
  catBrowse: 'பார்வையிட',
  catPageSub: 'ஒவ்வொரு பொருளும் ஒற்றை மூலம், சொந்த தயாரிப்பு — கலப்பும் இல்லை, வெளிக்கொடுப்பும் இல்லை.',

  bestEyebrow: 'அதிகம் விற்பனையானவை',
  bestTitle: 'ஆயிரம் சமையலறைகளின் விருப்பம்',
  viewAll: 'அனைத்தையும் காண',

  watchEyebrow: 'எப்படி தயாராகிறது என்று பாருங்கள்',
  watchTitle: 'மெதுவான முறை, தூய பாரம்பரியம்',
  watchDesc:
    'கொப்பரையும் விதைகளும் பண்ணையிலிருந்து மரச்செக்கு வரை பயணிப்பதைப் பாருங்கள். செக்கு மெதுவாகச் சுழல்கிறது — 25°Cக்குக் கீழ் — எதுவும் எரிவதில்லை; ஒவ்வொரு சொட்டிலும் சத்தும் மணமும் நிறமும் அப்படியே.',
  watchLi1: 'விதைகள் பண்ணையிலேயே வெயிலில் உலர்த்தி கையால் சுத்தம்',
  watchLi2: 'பாரம்பரிய மரச்செக்கில் ஆட்டப்படுகிறது, சுத்திகரிப்பு இல்லை',
  watchLi3: 'இயற்கையாக தெளிய வைத்து, துணியில் வடிகட்டி, தொகுப்பு-குறியீடு',
  watchCta: 'வித்தியாசத்தை சுவைத்துப் பாருங்கள்',

  processEyebrow: 'எப்படி தயாராகிறது',
  processTitle: 'பண்ணையிலிருந்து உங்கள் பாட்டில் வரை',
  step1t: 'மூலப்பொருள் சேகரிப்பு',
  step1d: 'விதைகள் நேரடியாக கூட்டு பண்ணைகளில் இருந்து — வெயிலில் உலர்த்தி கையால் சுத்தம்.',
  step2t: 'குளிர் ஆட்டல்',
  step2d: 'மரச்செக்கில் மெதுவாக ஆட்டல், சத்துக்களை காக்க 25°Cக்குக் கீழ்.',
  step3t: 'தெளிதல் & வடிகட்டல்',
  step3d: 'இயற்கையாக தெளிய வைத்து துணியில் வடிகட்டல் — ரசாயனம் இல்லை.',
  step4t: 'பாட்டிலடைத்தல்',
  step4d: 'அதே வாரம் உணவு-தர பாட்டில்களில் சீல் — தடமறிய தொகுப்பு-குறியீடு.',

  testiEyebrow: 'வாடிக்கையாளர்கள் சொல்வது',
  testiTitle: 'ஆயிரக்கணக்கான சமையலறைகளின் நம்பிக்கை',
  bulkTitle: 'கடை, உணவகம் அல்லது விழாவிற்கு வாங்குகிறீர்களா?',
  bulkDesc: 'மொத்தமாக வழங்குகிறோம் — 15L, 35L டிரம் மற்றும் தேவைக்கேற்ற அளவு, GST பில்லுடன்.',
  bulkCta: 'மொத்த விலை பெற',

  shopTitle: 'கடை',
  allProducts: 'அனைத்து பொருட்கள்',
  searchPlaceholder: 'பொருட்களைத் தேடுங்கள்…',
  categoryFilter: 'வகை',
  sortBy: 'வரிசைப்படுத்த',
  sortRecommended: 'பரிந்துரைக்கப்பட்டவை',
  sortPriceAsc: 'விலை: குறைவு முதல் அதிகம்',
  sortPriceDesc: 'விலை: அதிகம் முதல் குறைவு',
  sortRating: 'வாடிக்கையாளர் மதிப்பீடு',
  productsCount: 'பொருட்கள்',
  noMatch: 'இந்தத் தேடலுக்கு பொருட்கள் இல்லை',
  noMatchSub: 'வேறு சொல் முயற்சிக்கவும் அல்லது வடிகட்டிகளை அழிக்கவும்.',

  footerTagline:
    'நேரடியாக விவசாயிகளிடமிருந்து, பாரம்பரிய முறையில் — மரச்செக்கு எண்ணெய்கள், கைவினை சோப்புகள், கல்லில் அரைத்த பொடிகள்.',
  footerShop: 'கடை',
  footerSupport: 'உதவி',
  footerReach: 'தொடர்பு கொள்ள',
  footerAll: 'அனைத்து பொருட்கள்',
  footerCategories: 'வகைகள்',
  footerBulk: 'மொத்தம் / ஹோல்சேல்',
  footerWishlist: 'விருப்பப்பட்டியல்',
  footerContact: 'தொடர்பு கொள்ள',
  footerAccount: 'என் கணக்கு',
  footerRefunds: 'பணத்திரும்பல் & திருப்பம்',
  footerPrivacy: 'தனியுரிமைக் கொள்கை',
  footerRights: 'அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.',
  footerMotto: 'எப்போதும், அன்புடன் மரச்செக்கில்.',

  chatTitle: 'எங்களுடன் அரட்டை',
  chatReply: 'சில மணி நேரங்களில் பதிலளிப்போம்',
  chatLoginText: 'எங்கள் குழுவுடன் அரட்டையடிக்க உங்கள் மொபைல் எண்ணில் உள்நுழையவும்.',
  chatLoginBtn: 'உள்நுழைந்து அரட்டையடிக்க',
  chatPlaceholder: 'செய்தியை உள்ளிடவும்…',
  chatSend: 'அனுப்பு',
  chatGreeting: 'வணக்கம்! 🙏 எங்கள் பொருட்கள், உங்கள் ஆர்டர் அல்லது மொத்த விலை பற்றி எதுவும் கேளுங்கள்.',
};

const te = {
  announcement: '🚚 ₹499 పైన ఉచిత డెలివరీ · క్యాష్ ఆన్ డెలివరీ అందుబాటులో ఉంది · ప్రతి వారం తాజాగా ఆడుతారు',
  navHome: 'హోమ్',
  navShop: 'షాప్',
  navCategories: 'వర్గాలు',
  navBulk: 'టోకు అమ్మకాలు',
  navContact: 'సంప్రదించండి',
  navAdmin: 'అడ్మిన్',

  heroEyebrow: 'కచ్చి ఘాని · కలప-పిండిన · నేరుగా రైతుల నుండి',
  heroTitle: 'మా పొలాల నుండి మీ సీసా వరకు',
  heroSub: 'వేడి లేదు, రసాయనాలు లేవు, సత్వరమార్గాలు లేవు — విత్తనాలు, రాయి మరియు చెక్క గానుగ మాత్రమే.',
  shopAllOils: 'అన్ని ఉత్పత్తులు చూడండి',
  enquireBulk: 'టోకు విచారణ చేయండి',
  statProducts: 'సేంద్రియ ఉత్పత్తులు',
  statChemicals: 'రసాయనాలు లేదా కలుషితాలు',
  statTemp: 'గరిష్ట పిండే ఉష్ణోగ్రత',
  statTrace: 'పొలం వరకు గుర్తించదగినది',

  usp1t: 'పొలం నుండి నేరుగా పదార్థాలు',
  usp1d: 'భాగస్వామి రైతుల నుండి నేరుగా కొనుగోలు చేయబడి, ఎండలో ఆరబెట్టి, చేతితో శుభ్రం చేయబడినవి',
  usp2t: 'కలప-పిండిన (కచ్చి ఘాని)',
  usp2d: 'చెక్క కోల్హూలో నెమ్మదిగా పిండుతారు, ఎల్లప్పుడూ 25°C కంటే తక్కువ',
  usp3t: 'ల్యాబ్-పరీక్షించిన స్వచ్ఛత',
  usp3d: 'ప్రతి బ్యాచ్ పరీక్షించబడింది — రసాయనాలు, ద్రావకాలు లేదా కలుషితాలు శూన్యం',
  usp4t: 'ప్రతి వారం తాజాగా తయారవుతుంది',
  usp4d: 'చిన్న బ్యాచ్‌లు, బ్యాచ్-కోడెడ్, మీ ఇంటికి తాజాగా పంపబడతాయి',

  catEyebrow: 'వర్గం వారీగా కొనుగోలు చేయండి',
  catTitle: 'నూనెలు, సబ్బులు & పొడులు — ఒకే వాగ్దానం',
  catSub: 'ప్రతిదీ చిన్న బ్యాచ్‌లలో, ఒకే మూలం, పొలం-ప్రత్యక్ష పదార్థాలతో తయారవుతుంది.',
  catTag: '100% సేంద్రియ',
  catBrowse: 'బ్రౌజ్ చేయండి',
  catPageSub: 'ప్రతి ఉత్పత్తి ఒకే మూలం మరియు ఇంట్లోనే తయారు చేయబడింది — కలయిక లేదు, అవుట్‌సోర్సింగ్ లేదు.',

  bestEyebrow: 'బెస్ట్ సెల్లర్స్',
  bestTitle: 'వంటశాలల్లో ఇష్టపడేవి',
  viewAll: 'అన్ని ఉత్పత్తులు చూడండి',

  watchEyebrow: 'ఇది ఎలా తయారవుతుందో చూడండి',
  watchTitle: 'నెమ్మదిగా రూపొందించబడింది, సంప్రదాయబద్ధంగా స్వచ్ఛమైనది',
  watchDesc:
    'మా కొబ్బరి ముక్కలు మరియు విత్తనాలు పొలం గేటు నుండి చెక్క గానుగ వరకు ఎలా ప్రయాణిస్తాయో చూడండి. గానుగ నెమ్మదిగా తిరుగుతుంది — 25°C కంటే తక్కువ — కాబట్టి ఏమీ కాలదు, ఏమీ ఆక్సిడైజ్ కాదు, మరియు ప్రతి చుక్క దాని పోషకాలు, సువాసన మరియు రంగును కాపాడుకుంటుంది.',
  watchLi1: 'విత్తనాలు పొలంలోనే ఎండలో ఆరబెట్టి చేతితో శుభ్రం చేయబడతాయి',
  watchLi2: 'సాంప్రదాయ చెక్క కోల్హూలో పిండబడతాయి, ఎప్పుడూ శుద్ధి చేయబడదు',
  watchLi3: 'సహజంగా స్థిరపడి, గుడ్డతో వడపోసి, బ్యాచ్-కోడ్ చేయబడతాయి',
  watchCta: 'తేడాను రుచి చూడండి',

  processEyebrow: 'ఇది ఎలా తయారవుతుంది',
  processTitle: 'పొలం గేటు నుండి మీ సీసా వరకు',
  step1t: 'సోర్సింగ్',
  step1d: 'విత్తనాలు నేరుగా భాగస్వామి పొలాల నుండి కొనుగోలు చేయబడి, ఎండలో ఆరబెట్టి, చేతితో శుభ్రం చేయబడతాయి.',
  step2t: 'కోల్డ్-ప్రెస్సింగ్',
  step2d: 'పోషకాలను కాపాడటానికి చెక్క గానుగలో నెమ్మదిగా పిండబడతాయి, 25°C కంటే తక్కువ ఉంచబడతాయి.',
  step3t: 'స్థిరపడటం & వడపోత',
  step3d: 'సహజంగా స్థిరపడనివ్వబడి, తర్వాత గుడ్డతో వడపోయబడతాయి — రసాయన స్పష్టీకరణలు లేవు.',
  step4t: 'సీసాలో నింపడం',
  step4d: 'అదే వారంలో ఆహార-గ్రేడ్ సీసాల్లో మూసివేయబడతాయి, ట్రేసబిలిటీ కోసం బ్యాచ్-కోడ్ చేయబడతాయి.',

  testiEyebrow: 'వినియోగదారులు ఏమి చెబుతున్నారు',
  testiTitle: 'వేలాది వంటశాలల నమ్మకం',
  bulkTitle: 'దుకాణం, రెస్టారెంట్ లేదా ఈవెంట్ కోసం కొనుగోలు చేస్తున్నారా?',
  bulkDesc: 'మేము టోకుగా సరఫరా చేస్తాము — 15L, 35L డ్రమ్‌లు మరియు అనుకూల పరిమాణాలు, GST ఇన్వాయిస్‌తో.',
  bulkCta: 'టోకు ధర పొందండి',

  shopTitle: 'షాప్',
  allProducts: 'అన్ని ఉత్పత్తులు',
  searchPlaceholder: 'ఉత్పత్తులను వెతకండి…',
  categoryFilter: 'వర్గం',
  sortBy: 'క్రమం',
  sortRecommended: 'సిఫార్సు చేయబడింది',
  sortPriceAsc: 'ధర: తక్కువ నుండి ఎక్కువ',
  sortPriceDesc: 'ధర: ఎక్కువ నుండి తక్కువ',
  sortRating: 'వినియోగదారు రేటింగ్',
  productsCount: 'ఉత్పత్తులు',
  noMatch: 'ఈ శోధనకు ఉత్పత్తులు లేవు',
  noMatchSub: 'వేరే పదాన్ని ప్రయత్నించండి లేదా ఫిల్టర్‌లను క్లియర్ చేయండి.',

  footerTagline:
    'నేరుగా రైతుల నుండి, సాంప్రదాయ పద్ధతిలో — కలప-పిండిన (కచ్చి ఘాని) నూనెలు, చేతితో తయారు చేసిన సబ్బులు మరియు రాతిలో రుబ్బిన పొడులు.',
  footerShop: 'షాప్',
  footerSupport: 'మద్దతు',
  footerReach: 'మమ్మల్ని సంప్రదించండి',
  footerAll: 'అన్ని ఉత్పత్తులు',
  footerCategories: 'వర్గాలు',
  footerBulk: 'టోకు / హోల్‌సేల్',
  footerWishlist: 'విష్‌లిస్ట్',
  footerContact: 'మమ్మల్ని సంప్రదించండి',
  footerAccount: 'నా ఖాతా',
  footerRefunds: 'రిఫండ్ & రిటర్న్స్',
  footerPrivacy: 'గోప్యతా విధానం',
  footerRights: 'సర్వహక్కులు సురక్షితం.',
  footerMotto: 'ఎల్లప్పుడూ, శ్రద్ధతో కలప-పిండినవి.',

  chatTitle: 'మాతో చాట్ చేయండి',
  chatReply: 'మేము సాధారణంగా కొన్ని గంటల్లో స్పందిస్తాము',
  chatLoginText: 'మా బృందంతో చాట్ ప్రారంభించడానికి మీ మొబైల్ నంబర్‌తో లాగిన్ చేయండి.',
  chatLoginBtn: 'చాట్ చేయడానికి లాగిన్ చేయండి',
  chatPlaceholder: 'సందేశం టైప్ చేయండి…',
  chatSend: 'పంపండి',
  chatGreeting: 'నమస్తే! 🙏 మా ఉత్పత్తుల గురించి, మీ ఆర్డర్ గురించి లేదా టోకు ధరల గురించి ఏదైనా అడగండి.',
};

const kn = {
  announcement: '🚚 ₹499 ಮೇಲೆ ಉಚಿತ ಶಿಪ್ಪಿಂಗ್ · ಕ್ಯಾಶ್ ಆನ್ ಡೆಲಿವರಿ ಲಭ್ಯವಿದೆ · ಪ್ರತಿ ವಾರ ತಾಜಾ ಆಗಿ ಅರೆಯಲಾಗುತ್ತದೆ',
  navHome: 'ಮುಖಪುಟ',
  navShop: 'ಅಂಗಡಿ',
  navCategories: 'ವರ್ಗಗಳು',
  navBulk: 'ಸಗಟು ಮಾರಾಟ',
  navContact: 'ಸಂಪರ್ಕಿಸಿ',
  navAdmin: 'ಅಡ್ಮಿನ್',

  heroEyebrow: 'ಕಚ್ಚಿ ಘಾಣಿ · ಮರದ ಗಾಣದಲ್ಲಿ ಅರೆದದ್ದು · ನೇರವಾಗಿ ರೈತರಿಂದ',
  heroTitle: 'ನಮ್ಮ ಹೊಲಗಳಿಂದ ನಿಮ್ಮ ಬಾಟಲಿಗೆ',
  heroSub: 'ಶಾಖವಿಲ್ಲ, ರಾಸಾಯನಿಕಗಳಿಲ್ಲ, ಸುಲಭ ದಾರಿಗಳಿಲ್ಲ — ಬೀಜಗಳು, ಕಲ್ಲು ಮತ್ತು ಮರದ ಗಾಣ ಮಾತ್ರ.',
  shopAllOils: 'ಎಲ್ಲಾ ಉತ್ಪನ್ನಗಳನ್ನು ನೋಡಿ',
  enquireBulk: 'ಸಗಟು ವಿಚಾರಣೆ ಮಾಡಿ',
  statProducts: 'ಸಾವಯವ ಉತ್ಪನ್ನಗಳು',
  statChemicals: 'ರಾಸಾಯನಿಕಗಳು ಅಥವಾ ಕಲಬೆರಕೆ',
  statTemp: 'ಗರಿಷ್ಠ ಅರೆಯುವ ತಾಪಮಾನ',
  statTrace: 'ಹೊಲದವರೆಗೆ ಪತ್ತೆಹಚ್ಚಬಹುದಾದ',

  usp1t: 'ಹೊಲದಿಂದ ನೇರ ಪದಾರ್ಥಗಳು',
  usp1d: 'ಪಾಲುದಾರ ರೈತರಿಂದ ನೇರವಾಗಿ ಖರೀದಿಸಿ, ಬಿಸಿಲಿನಲ್ಲಿ ಒಣಗಿಸಿ, ಕೈಯಿಂದ ಸ್ವಚ್ಛಗೊಳಿಸಲಾಗಿದೆ',
  usp2t: 'ಮರದ ಗಾಣದಲ್ಲಿ ಅರೆದದ್ದು (ಕಚ್ಚಿ ಘಾಣಿ)',
  usp2d: 'ಮರದ ಕೊಲ್ಹುವಿನಲ್ಲಿ ನಿಧಾನವಾಗಿ ಅರೆಯಲಾಗುತ್ತದೆ, ಯಾವಾಗಲೂ 25°C ಗಿಂತ ಕಡಿಮೆ',
  usp3t: 'ಪ್ರಯೋಗಾಲಯ-ಪರೀಕ್ಷಿತ ಶುದ್ಧತೆ',
  usp3d: 'ಪ್ರತಿ ಬ್ಯಾಚ್ ಪರೀಕ್ಷಿಸಲಾಗಿದೆ — ರಾಸಾಯನಿಕಗಳು, ದ್ರಾವಕಗಳು ಅಥವಾ ಕಲಬೆರಕೆ ಶೂನ್ಯ',
  usp4t: 'ಪ್ರತಿ ವಾರ ತಾಜಾ ತಯಾರಿಕೆ',
  usp4d: 'ಚಿಕ್ಕ ಬ್ಯಾಚ್‌ಗಳು, ಬ್ಯಾಚ್-ಕೋಡೆಡ್, ನಿಮ್ಮ ಮನೆ ಬಾಗಿಲಿಗೆ ತಾಜಾ ಆಗಿ ಕಳುಹಿಸಲಾಗುತ್ತದೆ',

  catEyebrow: 'ವರ್ಗದ ಪ್ರಕಾರ ಖರೀದಿಸಿ',
  catTitle: 'ಎಣ್ಣೆಗಳು, ಸಾಬೂನುಗಳು ಮತ್ತು ಪುಡಿಗಳು — ಒಂದೇ ಭರವಸೆ',
  catSub: 'ಎಲ್ಲವೂ ಚಿಕ್ಕ ಬ್ಯಾಚ್‌ಗಳಲ್ಲಿ, ಏಕ-ಮೂಲ, ಹೊಲದ-ನೇರ ಪದಾರ್ಥಗಳಿಂದ ತಯಾರಿಸಲಾಗುತ್ತದೆ.',
  catTag: '100% ಸಾವಯವ',
  catBrowse: 'ಬ್ರೌಸ್ ಮಾಡಿ',
  catPageSub: 'ಪ್ರತಿ ಉತ್ಪನ್ನವು ಏಕ-ಮೂಲ ಮತ್ತು ಮನೆಯಲ್ಲೇ ತಯಾರಿಸಲಾಗಿದೆ — ಮಿಶ್ರಣವಿಲ್ಲ, ಹೊರಗುತ್ತಿಗೆ ಇಲ್ಲ.',

  bestEyebrow: 'ಬೆಸ್ಟ್‌ಸೆಲ್ಲರ್‌ಗಳು',
  bestTitle: 'ಅಡುಗೆಮನೆಗಳಲ್ಲಿ ಇಷ್ಟಪಡುವಂತಹವು',
  viewAll: 'ಎಲ್ಲಾ ಉತ್ಪನ್ನಗಳನ್ನು ನೋಡಿ',

  watchEyebrow: 'ಇದು ಹೇಗೆ ತಯಾರಾಗುತ್ತದೆ ಎಂದು ನೋಡಿ',
  watchTitle: 'ನಿಧಾನವಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾಗಿದೆ, ಸಂಪ್ರದಾಯದಲ್ಲಿ ಶುದ್ಧ',
  watchDesc:
    'ನಮ್ಮ ಕೊಬ್ಬರಿ ಮತ್ತು ಬೀಜಗಳು ಹೊಲದ ಗೇಟಿನಿಂದ ಮರದ ಗಾಣದವರೆಗೆ ಹೇಗೆ ಪ್ರಯಾಣಿಸುತ್ತವೆ ಎಂಬುದನ್ನು ನೋಡಿ. ಗಾಣ ನಿಧಾನವಾಗಿ ತಿರುಗುತ್ತದೆ — 25°C ಗಿಂತ ಕಡಿಮೆ — ಆದ್ದರಿಂದ ಏನೂ ಸುಡುವುದಿಲ್ಲ, ಏನೂ ಆಕ್ಸಿಡೀಕರಣಗೊಳ್ಳುವುದಿಲ್ಲ, ಮತ್ತು ಪ್ರತಿ ಹನಿಯೂ ತನ್ನ ಪೋಷಕಾಂಶಗಳು, ಪರಿಮಳ ಮತ್ತು ಬಣ್ಣವನ್ನು ಉಳಿಸಿಕೊಳ್ಳುತ್ತದೆ.',
  watchLi1: 'ಬೀಜಗಳನ್ನು ಹೊಲದಲ್ಲೇ ಬಿಸಿಲಿನಲ್ಲಿ ಒಣಗಿಸಿ ಕೈಯಿಂದ ಸ್ವಚ್ಛಗೊಳಿಸಲಾಗುತ್ತದೆ',
  watchLi2: 'ಸಾಂಪ್ರದಾಯಿಕ ಮರದ ಕೊಲ್ಹುವಿನಲ್ಲಿ ಅರೆಯಲಾಗುತ್ತದೆ, ಎಂದಿಗೂ ಸಂಸ್ಕರಿಸುವುದಿಲ್ಲ',
  watchLi3: 'ಸ್ವಾಭಾವಿಕವಾಗಿ ನೆಲೆಗೊಂಡು, ಬಟ್ಟೆಯಿಂದ ಸೋಸಿ, ಬ್ಯಾಚ್-ಕೋಡ್ ಮಾಡಲಾಗುತ್ತದೆ',
  watchCta: 'ವ್ಯತ್ಯಾಸವನ್ನು ರುಚಿ ನೋಡಿ',

  processEyebrow: 'ಇದು ಹೇಗೆ ತಯಾರಾಗುತ್ತದೆ',
  processTitle: 'ಹೊಲದ ಗೇಟಿನಿಂದ ನಿಮ್ಮ ಬಾಟಲಿಗೆ',
  step1t: 'ಮೂಲ ಸಂಗ್ರಹಣೆ',
  step1d: 'ಬೀಜಗಳನ್ನು ನೇರವಾಗಿ ಪಾಲುದಾರ ಹೊಲಗಳಿಂದ ಖರೀದಿಸಿ, ಬಿಸಿಲಿನಲ್ಲಿ ಒಣಗಿಸಿ, ಕೈಯಿಂದ ಸ್ವಚ್ಛಗೊಳಿಸಲಾಗುತ್ತದೆ.',
  step2t: 'ಕೋಲ್ಡ್-ಪ್ರೆಸ್ಸಿಂಗ್',
  step2d: 'ಪೋಷಕಾಂಶಗಳನ್ನು ರಕ್ಷಿಸಲು ಮರದ ಗಾಣದಲ್ಲಿ ನಿಧಾನವಾಗಿ ಅರೆಯಲಾಗುತ್ತದೆ, 25°C ಗಿಂತ ಕಡಿಮೆ ಇರಿಸಲಾಗುತ್ತದೆ.',
  step3t: 'ನೆಲೆಗೊಳಿಸುವಿಕೆ ಮತ್ತು ಸೋಸುವಿಕೆ',
  step3d: 'ಸ್ವಾಭಾವಿಕವಾಗಿ ನೆಲೆಗೊಳ್ಳಲು ಬಿಟ್ಟು, ನಂತರ ಬಟ್ಟೆಯಿಂದ ಸೋಸಲಾಗುತ್ತದೆ — ರಾಸಾಯನಿಕ ಸ್ಪಷ್ಟೀಕಾರಕಗಳಿಲ್ಲ.',
  step4t: 'ಬಾಟಲಿಗೆ ತುಂಬಿಸುವಿಕೆ',
  step4d: 'ಅದೇ ವಾರದಲ್ಲಿ ಆಹಾರ-ದರ್ಜೆಯ ಬಾಟಲಿಗಳಲ್ಲಿ ಮುಚ್ಚಲಾಗುತ್ತದೆ, ಪತ್ತೆಹಚ್ಚುವಿಕೆಗಾಗಿ ಬ್ಯಾಚ್-ಕೋಡ್ ಮಾಡಲಾಗುತ್ತದೆ.',

  testiEyebrow: 'ಗ್ರಾಹಕರು ಏನು ಹೇಳುತ್ತಾರೆ',
  testiTitle: 'ಸಾವಿರಾರು ಅಡುಗೆಮನೆಗಳ ನಂಬಿಕೆ',
  bulkTitle: 'ಅಂಗಡಿ, ರೆಸ್ಟೋರೆಂಟ್ ಅಥವಾ ಈವೆಂಟ್‌ಗಾಗಿ ಖರೀದಿಸುತ್ತಿದ್ದೀರಾ?',
  bulkDesc: 'ನಾವು ಸಗಟಾಗಿ ಪೂರೈಸುತ್ತೇವೆ — 15L, 35L ಡ್ರಮ್‌ಗಳು ಮತ್ತು ಕಸ್ಟಮ್ ಪ್ರಮಾಣಗಳು, GST ಇನ್‌ವಾಯ್ಸ್‌ನೊಂದಿಗೆ.',
  bulkCta: 'ಸಗಟು ದರ ಪಡೆಯಿರಿ',

  shopTitle: 'ಅಂಗಡಿ',
  allProducts: 'ಎಲ್ಲಾ ಉತ್ಪನ್ನಗಳು',
  searchPlaceholder: 'ಉತ್ಪನ್ನಗಳನ್ನು ಹುಡುಕಿ…',
  categoryFilter: 'ವರ್ಗ',
  sortBy: 'ವಿಂಗಡಿಸಿ',
  sortRecommended: 'ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ',
  sortPriceAsc: 'ಬೆಲೆ: ಕಡಿಮೆಯಿಂದ ಹೆಚ್ಚಿಗೆ',
  sortPriceDesc: 'ಬೆಲೆ: ಹೆಚ್ಚಿನಿಂದ ಕಡಿಮೆಗೆ',
  sortRating: 'ಗ್ರಾಹಕರ ರೇಟಿಂಗ್',
  productsCount: 'ಉತ್ಪನ್ನಗಳು',
  noMatch: 'ಈ ಹುಡುಕಾಟಕ್ಕೆ ಉತ್ಪನ್ನಗಳಿಲ್ಲ',
  noMatchSub: 'ಬೇರೆ ಪದವನ್ನು ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಫಿಲ್ಟರ್‌ಗಳನ್ನು ತೆರವುಗೊಳಿಸಿ.',

  footerTagline:
    'ನೇರವಾಗಿ ರೈತರಿಂದ, ಸಾಂಪ್ರದಾಯಿಕ ರೀತಿಯಲ್ಲಿ — ಮರದ ಗಾಣದ (ಕಚ್ಚಿ ಘಾಣಿ) ಎಣ್ಣೆಗಳು, ಕೈಯಿಂದ ತಯಾರಿಸಿದ ಸಾಬೂನುಗಳು ಮತ್ತು ಕಲ್ಲಿನಲ್ಲಿ ಅರೆದ ಪುಡಿಗಳು.',
  footerShop: 'ಅಂಗಡಿ',
  footerSupport: 'ಬೆಂಬಲ',
  footerReach: 'ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ',
  footerAll: 'ಎಲ್ಲಾ ಉತ್ಪನ್ನಗಳು',
  footerCategories: 'ವರ್ಗಗಳು',
  footerBulk: 'ಸಗಟು / ಹೋಲ್‌ಸೇಲ್',
  footerWishlist: 'ಬಯಕೆಪಟ್ಟಿ',
  footerContact: 'ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ',
  footerAccount: 'ನನ್ನ ಖಾತೆ',
  footerRefunds: 'ಮರುಪಾವತಿ ಮತ್ತು ಹಿಂತಿರುಗಿಸುವಿಕೆ',
  footerPrivacy: 'ಗೌಪ್ಯತಾ ನೀತಿ',
  footerRights: 'ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.',
  footerMotto: 'ಯಾವಾಗಲೂ, ಕಾಳಜಿಯಿಂದ ಮರದ ಗಾಣದಲ್ಲಿ ಅರೆದದ್ದು.',

  chatTitle: 'ನಮ್ಮೊಂದಿಗೆ ಚಾಟ್ ಮಾಡಿ',
  chatReply: 'ನಾವು ಸಾಮಾನ್ಯವಾಗಿ ಕೆಲವು ಗಂಟೆಗಳಲ್ಲಿ ಪ್ರತಿಕ್ರಿಯಿಸುತ್ತೇವೆ',
  chatLoginText: 'ನಮ್ಮ ತಂಡದೊಂದಿಗೆ ಚಾಟ್ ಪ್ರಾರಂಭಿಸಲು ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯೊಂದಿಗೆ ಲಾಗಿನ್ ಮಾಡಿ.',
  chatLoginBtn: 'ಚಾಟ್ ಮಾಡಲು ಲಾಗಿನ್ ಮಾಡಿ',
  chatPlaceholder: 'ಸಂದೇಶ ಟೈಪ್ ಮಾಡಿ…',
  chatSend: 'ಕಳುಹಿಸಿ',
  chatGreeting: 'ನಮಸ್ಕಾರ! 🙏 ನಮ್ಮ ಉತ್ಪನ್ನಗಳು, ನಿಮ್ಮ ಆರ್ಡರ್ ಅಥವಾ ಸಗಟು ಬೆಲೆಗಳ ಬಗ್ಗೆ ಏನು ಬೇಕಾದರೂ ಕೇಳಿ.',
};

const dictionaries = { en, hi, ta, te, kn };

const LangContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem('yo_lang');
    return dictionaries[saved] ? saved : 'en';
  });

  function setLang(code) {
    if (!dictionaries[code]) return;
    localStorage.setItem('yo_lang', code);
    setLangState(code);
    document.documentElement.lang = code;
  }

  function t(key) {
    return dictionaries[lang][key] ?? en[key] ?? key;
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
