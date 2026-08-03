const BASE_URL = '/api';

async function request(path, { method = 'GET', body, token, formData } = {}) {
  const headers = {};
  if (!formData) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: formData || (body ? JSON.stringify(body) : undefined),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong. Please try again.');
  }
  return data;
}

export const api = {
  // auth
  sendOtp: (phone, country, channel, email) =>
    request('/auth/send-otp', { method: 'POST', body: { phone, country, channel, email } }),
  verifyOtp: (phone, otp, name, referralCode) =>
    request('/auth/verify-otp', { method: 'POST', body: { phone, otp, name, referralCode } }),
  me: (token) => request('/auth/me', { token }),
  updateProfile: (token, updates) => request('/auth/me', { method: 'PUT', body: updates, token }),

  // products
  // token is optional — passed by callers that should see early-access
  // products they qualify for (see backend routes/products.js); omitted
  // callers get the public/guest view, same as before this parameter existed.
  getProducts: (params = {}, token) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ''}`, { token });
  },
  getCategories: () => request('/products/categories'),
  getProduct: (id, token) => request(`/products/${id}`, { token }),
  getBatch: (batchNumber) => request(`/products/batch/${encodeURIComponent(batchNumber)}`),
  getReviews: (id) => request(`/products/${id}/reviews`),
  submitReview: (token, id, payload) => request(`/products/${id}/reviews`, { method: 'POST', body: payload, token }),
  getProductQuestions: (id) => request(`/products/${id}/questions`),
  askProductQuestion: (token, id, question) => request(`/products/${id}/questions`, { method: 'POST', body: { question }, token }),
  uploadReviewPhoto: (token, formData) => request('/products/reviews/photo', { method: 'POST', formData, token }),
  getReviewGallery: (limit) => request(`/products/reviews/gallery${limit ? `?limit=${limit}` : ''}`),

  // banners (home page hero)
  getBanners: () => request('/banners'),

  // static page banners (shop, categories, combos, contact, bulk-enquiry)
  getPageBanner: (page) => request(`/page-banners/${page}`),

  // pincode -> city/state lookup for the checkout address form
  lookupPincode: (pincode) => request(`/pincode/${pincode}`),

  // INR-based conversion rates for the storefront currency selector
  getCurrencyRates: () => request('/currency/rates'),

  // sale countdown banner
  getSaleBanner: () => request('/sale-banner'),

  // "Notify me when back in stock" — token is optional, guests pass an email
  subscribeStockNotify: (payload, token) => request('/stock-notify', { method: 'POST', body: payload, token }),

  // Manually-curated showcase of real reviews from the business's Google listing
  getHomepageReviews: () => request('/homepage-reviews'),

  // blog
  getBlogPosts: () => request('/blog'),
  getBlogPost: (slug) => request(`/blog/${slug}`),
  likeBlogPost: (slug) => request(`/blog/${slug}/like`, { method: 'POST' }),
  getBlogComments: (slug) => request(`/blog/${slug}/comments`),
  addBlogComment: (token, slug, text) => request(`/blog/${slug}/comments`, { method: 'POST', body: { text }, token }),

  // cart
  getCart: (token) => request('/cart', { token }),
  syncCart: (token, items) => request('/cart', { method: 'PUT', body: { items }, token }),
  addCartItem: (token, item) => request('/cart/item', { method: 'POST', body: item, token }),
  updateCartItem: (token, item) => request('/cart/item', { method: 'PATCH', body: item, token }),
  removeCartItem: (token, item) => request('/cart/item', { method: 'DELETE', body: item, token }),

  // wishlist
  getWishlist: (token) => request('/wishlist', { token }),
  addWishlist: (token, productId) => request('/wishlist', { method: 'POST', body: { productId }, token }),
  removeWishlist: (token, productId) => request(`/wishlist/${productId}`, { method: 'DELETE', token }),

  // orders
  verifyCodPhone: (phone, otp) => request('/orders/verify-cod-phone', { method: 'POST', body: { phone, otp } }),
  placeOrder: (token, payload) => request('/orders', { method: 'POST', body: payload, token }),
  getOrders: (token) => request('/orders', { token }),
  getOrder: (token, id) => request(`/orders/${id}`, { token }),
  cancelOrder: (token, id) => request(`/orders/${id}/cancel`, { method: 'PATCH', token }),
  requestReturn: (token, id, payload) => request(`/orders/${id}/return`, { method: 'PATCH', body: payload, token }),
  requestBottleReturn: (token, id, quantity) => request(`/orders/${id}/bottle-return`, { method: 'POST', body: { quantity }, token }),
  getBottleReturnQr: (token, id) => request(`/orders/${id}/bottle-return/qr`, { token }),
  createRazorpayOrder: (token, payload) => request('/orders/razorpay/create', { method: 'POST', body: payload, token }),
  verifyRazorpayPayment: (token, payload) => request('/orders/razorpay/verify', { method: 'POST', body: payload, token }),
  createCodAdvanceOrder: (token, payload) => request('/orders/cod-advance/create', { method: 'POST', body: payload, token }),
  verifyCodAdvancePayment: (token, payload) => request('/orders/cod-advance/verify', { method: 'POST', body: payload, token }),
  createOrderPayment: (token, id) => request(`/orders/${id}/pay/create`, { method: 'POST', token }),
  verifyOrderPayment: (token, id, payload) => request(`/orders/${id}/pay/verify`, { method: 'POST', body: payload, token }),

  // coupons
  validateCoupon: (token, payload) => request('/coupons/validate', { method: 'POST', body: payload, token }),
  getFeaturedCoupon: () => request('/coupons/featured'),

  // gift cards
  getGiftCardConfig: () => request('/gift-cards/config'),
  validateGiftCard: (token, code) => request('/gift-cards/validate', { method: 'POST', body: { code }, token }),
  createGiftCardPurchase: (token, payload) => request('/gift-cards/purchase/create', { method: 'POST', body: payload, token }),
  verifyGiftCardPurchase: (token, payload) => request('/gift-cards/purchase/verify', { method: 'POST', body: payload, token }),

  // affiliate program
  validateAffiliateCode: (token, code) => request('/affiliates/validate', { method: 'POST', body: { code }, token }),
  getMyAffiliate: (token) => request('/affiliates/me', { token }),

  // seller marketplace portal
  getSellerStorefront: (id) => request(`/seller/storefront/${id}`),
  seller: {
    apply: (token, payload) => request('/seller/apply', { method: 'POST', body: payload, token }),
    getMe: (token) => request('/seller/me', { token }),
    updateProfile: (token, payload) => request('/seller/profile', { method: 'PUT', body: payload, token }),
    submitSupport: (token, payload) => request('/seller/support', { method: 'POST', body: payload, token }),
    getQuestions: (token) => request('/seller/questions', { token }),
    answerQuestion: (token, id, answer) => request(`/seller/questions/${id}`, { method: 'PATCH', body: { answer }, token }),
    uploadImage: (token, formData) => request('/seller/upload-image', { method: 'POST', formData, token }),
    getProducts: (token) => request('/seller/products', { token }),
    createProduct: (token, payload) => request('/seller/products', { method: 'POST', body: payload, token }),
    updateProduct: (token, id, payload) => request(`/seller/products/${id}`, { method: 'PUT', body: payload, token }),
    setProductActive: (token, id, active) => request(`/seller/products/${id}/deactivate`, { method: 'PATCH', body: { active }, token }),
  },

  // subscriptions (Subscribe & Save)
  getSubscriptions: (token) => request('/subscriptions', { token }),
  createSubscription: (token, payload) => request('/subscriptions', { method: 'POST', body: payload, token }),
  updateSubscription: (token, id, patch) => request(`/subscriptions/${id}`, { method: 'PATCH', body: patch, token }),
  createSubscriptionAutopay: (token, id) => request(`/subscriptions/${id}/autopay/create`, { method: 'POST', token }),
  verifySubscriptionAutopay: (token, id, payload) => request(`/subscriptions/${id}/autopay/verify`, { method: 'POST', body: payload, token }),

  // loyalty (reward points)
  getLoyalty: (token) => request('/loyalty', { token }),

  // sustainability impact (bottle reuse) — token optional, returns site-wide
  // totals either way and adds a personal breakdown when logged in
  getImpact: (token) => request('/impact', { token }),

  // public config flags
  getConfig: () => request('/config'),

  // bulk enquiry + contact
  submitBulkEnquiry: (payload, token) => request('/bulk-enquiry', { method: 'POST', body: payload, token }),
  submitContact: (payload) => request('/contact', { method: 'POST', body: payload }),

  // notifications (customer)
  getNotifications: (token) => request('/notifications', { token }),
  markNotificationRead: (token, id) => request(`/notifications/${id}/read`, { method: 'POST', token }),
  markAllNotificationsRead: (token) => request('/notifications/read-all', { method: 'POST', token }),
  getPushKey: () => request('/notifications/push-key'),
  subscribePush: (token, subscription) => request('/notifications/push-subscribe', { method: 'POST', body: { subscription }, token }),
  unsubscribePush: (token, payload) => request('/notifications/push-unsubscribe', { method: 'POST', body: payload, token }),
  subscribePushAnonymous: (subscription) => request('/notifications/push-subscribe-anonymous', { method: 'POST', body: { subscription } }),

  // chat (customer)
  getChat: (token) => request('/chat', { token }),
  getChatUnread: (token) => request('/chat/unread', { token }),
  sendChat: (token, text) => request('/chat', { method: 'POST', body: { text }, token }),

  // AI shopping/support assistant (no login required)
  askAiAssistant: (message, history) => request('/ai-assistant', { method: 'POST', body: { message, history } }),

  // admin
  admin: {
    stats: (token) => request('/admin/stats', { token }),

    uploadImage: (token, formData) => request('/admin/upload-image', { method: 'POST', formData, token }),

    createProduct: (token, product) => request('/admin/products', { method: 'POST', body: product, token }),
    updateProduct: (token, id, product) => request(`/admin/products/${id}`, { method: 'PUT', body: product, token }),
    deleteProduct: (token, id) => request(`/admin/products/${id}`, { method: 'DELETE', token }),
    translateDescription: (token, body) => request('/admin/products/translate-description', { method: 'POST', body, token }),
    translateAllProducts: (token) => request('/admin/products/translate-all', { method: 'POST', token }),

    getCategories: (token) => request('/admin/categories', { token }),
    createCategory: (token, category) => request('/admin/categories', { method: 'POST', body: category, token }),
    updateCategory: (token, id, category) => request(`/admin/categories/${id}`, { method: 'PUT', body: category, token }),
    deleteCategory: (token, id) => request(`/admin/categories/${id}`, { method: 'DELETE', token }),

    getBanners: (token) => request('/admin/banners', { token }),
    uploadBanner: (token, formData) => request('/admin/banners', { method: 'POST', formData, token }),
    updateBanner: (token, id, patch) => request(`/admin/banners/${id}`, { method: 'PATCH', body: patch, token }),
    deleteBanner: (token, id) => request(`/admin/banners/${id}`, { method: 'DELETE', token }),

    getOrders: (token) => request('/admin/orders', { token }),
    updateOrderStatus: (token, id, status) =>
      request(`/admin/orders/${id}`, { method: 'PATCH', body: { status }, token }),
    updateReturnStatus: (token, id, status) =>
      request(`/admin/orders/${id}/return`, { method: 'PATCH', body: { status }, token }),
    updateBottleReturnStatus: (token, id, status) =>
      request(`/admin/orders/${id}/bottle-return`, { method: 'PATCH', body: { status }, token }),

    getBlogPosts: (token) => request('/admin/blog', { token }),
    createBlogPost: (token, post) => request('/admin/blog', { method: 'POST', body: post, token }),
    updateBlogPost: (token, id, post) => request(`/admin/blog/${id}`, { method: 'PUT', body: post, token }),
    deleteBlogPost: (token, id) => request(`/admin/blog/${id}`, { method: 'DELETE', token }),
    getBlogSettings: (token) => request('/admin/blog-settings', { token }),
    updateBlogSettings: (token, settings) => request('/admin/blog-settings', { method: 'PUT', body: settings, token }),
    deleteBlogComment: (token, id) => request(`/admin/blog-comments/${id}`, { method: 'DELETE', token }),

    getPageBanner: (token, page) => request(`/admin/page-banners/${page}`, { token }),
    updatePageBanner: (token, page, settings) =>
      request(`/admin/page-banners/${page}`, { method: 'PUT', body: settings, token }),

    getSaleBanner: (token) => request('/admin/sale-banner', { token }),
    updateSaleBanner: (token, settings) => request('/admin/sale-banner', { method: 'PUT', body: settings, token }),
    getPaymentMethods: (token) => request('/admin/payment-methods', { token }),
    updatePaymentMethods: (token, methods) => request('/admin/payment-methods', { method: 'PUT', body: methods, token }),
    getShippingSettings: (token) => request('/admin/shipping-settings', { token }),
    updateShippingSettings: (token, settings) => request('/admin/shipping-settings', { method: 'PUT', body: settings, token }),
    getGiftCards: (token) => request('/admin/gift-cards', { token }),
    cancelGiftCard: (token, code) => request(`/admin/gift-cards/${code}/cancel`, { method: 'PATCH', token }),
    setCustomerAffiliate: (token, id, payload) => request(`/admin/customers/${id}/affiliate`, { method: 'PATCH', body: payload, token }),
    getAffiliates: (token) => request('/admin/affiliates', { token }),
    recordAffiliatePayout: (token, id, payload) => request(`/admin/affiliates/${id}/payout`, { method: 'POST', body: payload, token }),
    getSellerApplications: (token, status) => request(`/admin/seller-applications${status ? `?status=${status}` : ''}`, { token }),
    decideSellerApplication: (token, id, payload) => request(`/admin/seller-applications/${id}`, { method: 'PATCH', body: payload, token }),
    getSellers: (token) => request('/admin/sellers', { token }),
    recordSellerPayout: (token, id, payload) => request(`/admin/sellers/${id}/payout`, { method: 'POST', body: payload, token }),
    getPendingSellerProducts: (token) => request('/admin/seller-products/pending', { token }),
    moderateSellerProduct: (token, id, approve) => request(`/admin/seller-products/${id}/moderate`, { method: 'PATCH', body: { approve }, token }),
    getSellerSupport: (token) => request('/admin/seller-support', { token }),
    updateSellerSupport: (token, id, status) => request(`/admin/seller-support/${id}`, { method: 'PATCH', body: { status }, token }),
    getHomepageReviews: (token) => request('/admin/homepage-reviews', { token }),
    updateHomepageReviews: (token, settings) => request('/admin/homepage-reviews', { method: 'PUT', body: settings, token }),
    getCountryCatalog: (token) => request('/admin/country-catalog', { token }),
    updateCountryCatalog: (token, countries) => request('/admin/country-catalog', { method: 'PUT', body: { countries }, token }),

    getCurrencyOverrides: (token) => request('/admin/currency-overrides', { token }),
    updateCurrencyOverrides: (token, body) =>
      request('/admin/currency-overrides', { method: 'PUT', body, token }),

    getCoupons: (token) => request('/admin/coupons', { token }),
    createCoupon: (token, coupon) => request('/admin/coupons', { method: 'POST', body: coupon, token }),
    updateCoupon: (token, id, patch) => request(`/admin/coupons/${id}`, { method: 'PATCH', body: patch, token }),
    deleteCoupon: (token, id) => request(`/admin/coupons/${id}`, { method: 'DELETE', token }),

    getSubscriptions: (token) => request('/admin/subscriptions', { token }),
    runSubscriptions: (token) => request('/admin/subscriptions/run', { method: 'POST', token }),
    runReorderNudges: (token) => request('/admin/reorder-nudges/run', { method: 'POST', token }),

    getWhatsAppStatus: (token) => request('/admin/whatsapp', { token }),
    resetWhatsApp: (token) => request('/admin/whatsapp/reset', { method: 'POST', token }),
    setWhatsAppOrdering: (token, enabled) => request('/admin/whatsapp/ordering', { method: 'POST', body: { enabled }, token }),
    getWhatsAppEligibleRecipients: (token) => request('/admin/whatsapp/eligible-recipients', { token }),
    sendWhatsAppBroadcast: (token, payload) => request('/admin/whatsapp/broadcast', { method: 'POST', body: payload, token }),
    getWhatsAppBroadcastLog: (token) => request('/admin/whatsapp/broadcast-log', { token }),

    getCustomers: (token) => request('/admin/customers', { token }),
    setCustomerWholesale: (token, id, isWholesale) => request(`/admin/customers/${id}/wholesale`, { method: 'PATCH', body: { isWholesale }, token }),
    getEnquiries: (token) => request('/admin/enquiries', { token }),
    updateEnquiry: (token, id, status) =>
      request(`/admin/enquiries/${id}`, { method: 'PATCH', body: { status }, token }),
    getContacts: (token) => request('/admin/contacts', { token }),
    getProductQuestions: (token) => request('/admin/product-questions', { token }),
    answerProductQuestion: (token, id, answer) => request(`/admin/product-questions/${id}`, { method: 'PATCH', body: { answer }, token }),
    suggestProductAnswer: (token, id) => request(`/admin/product-questions/${id}/suggest-answer`, { method: 'POST', token }),

    notify: (token, payload) => request('/admin/notify', { method: 'POST', body: payload, token }),
    notifyLogs: (token) => request('/admin/notify/logs', { token }),

    getConversations: (token) => request('/admin/chat', { token }),
    getThread: (token, userId) => request(`/admin/chat/${userId}`, { token }),
    sendMessage: (token, userId, text) =>
      request(`/admin/chat/${userId}`, { method: 'POST', body: { text }, token }),
  },
};
