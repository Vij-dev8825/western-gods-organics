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
  sendOtp: (phone, country) => request('/auth/send-otp', { method: 'POST', body: { phone, country } }),
  verifyOtp: (phone, otp, name, referralCode) =>
    request('/auth/verify-otp', { method: 'POST', body: { phone, otp, name, referralCode } }),
  me: (token) => request('/auth/me', { token }),
  updateProfile: (token, updates) => request('/auth/me', { method: 'PUT', body: updates, token }),

  // products
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/products${qs ? `?${qs}` : ''}`);
  },
  getCategories: () => request('/products/categories'),
  getProduct: (id) => request(`/products/${id}`),
  getReviews: (id) => request(`/products/${id}/reviews`),
  submitReview: (token, id, payload) => request(`/products/${id}/reviews`, { method: 'POST', body: payload, token }),

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
  placeOrder: (token, payload) => request('/orders', { method: 'POST', body: payload, token }),
  getOrders: (token) => request('/orders', { token }),
  getOrder: (token, id) => request(`/orders/${id}`, { token }),
  cancelOrder: (token, id) => request(`/orders/${id}/cancel`, { method: 'PATCH', token }),
  requestReturn: (token, id, payload) => request(`/orders/${id}/return`, { method: 'PATCH', body: payload, token }),
  createRazorpayOrder: (token, payload) => request('/orders/razorpay/create', { method: 'POST', body: payload, token }),
  verifyRazorpayPayment: (token, payload) => request('/orders/razorpay/verify', { method: 'POST', body: payload, token }),

  // coupons
  validateCoupon: (token, payload) => request('/coupons/validate', { method: 'POST', body: payload, token }),
  getFeaturedCoupon: () => request('/coupons/featured'),

  // subscriptions (Subscribe & Save)
  getSubscriptions: (token) => request('/subscriptions', { token }),
  createSubscription: (token, payload) => request('/subscriptions', { method: 'POST', body: payload, token }),
  updateSubscription: (token, id, patch) => request(`/subscriptions/${id}`, { method: 'PATCH', body: patch, token }),

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

  // admin
  admin: {
    stats: (token) => request('/admin/stats', { token }),

    uploadImage: (token, formData) => request('/admin/upload-image', { method: 'POST', formData, token }),

    createProduct: (token, product) => request('/admin/products', { method: 'POST', body: product, token }),
    updateProduct: (token, id, product) => request(`/admin/products/${id}`, { method: 'PUT', body: product, token }),
    deleteProduct: (token, id) => request(`/admin/products/${id}`, { method: 'DELETE', token }),

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

    getCustomers: (token) => request('/admin/customers', { token }),
    getEnquiries: (token) => request('/admin/enquiries', { token }),
    updateEnquiry: (token, id, status) =>
      request(`/admin/enquiries/${id}`, { method: 'PATCH', body: { status }, token }),
    getContacts: (token) => request('/admin/contacts', { token }),

    notify: (token, payload) => request('/admin/notify', { method: 'POST', body: payload, token }),
    notifyLogs: (token) => request('/admin/notify/logs', { token }),

    getConversations: (token) => request('/admin/chat', { token }),
    getThread: (token, userId) => request(`/admin/chat/${userId}`, { token }),
    sendMessage: (token, userId, text) =>
      request(`/admin/chat/${userId}`, { method: 'POST', body: { text }, token }),
  },
};
