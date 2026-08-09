// Service worker: (1) browser/OS push notifications — registered once from
// utils/pushNotifications.js after the customer opts in — and (2) basic
// offline support for the installed PWA, registered unconditionally on every
// page load from main.jsx. Bump CACHE_NAME to force old runtime-cached
// responses to be dropped on the next deploy.
const CACHE_NAME = 'wgo-runtime-v2';

/** Build output under /assets carries a content hash in its filename, so a
 * cached copy can never be the wrong copy — a changed file arrives at a new
 * URL. That makes it safe to answer from cache without asking the network
 * first, which is the difference between an instant load and one that waits
 * out a round-trip per file on a weak signal. */
function isImmutableAsset(url) {
  return url.pathname.startsWith('/assets/');
}

/** Media is served from long-lived, content-addressed ids too, but it's big
 * and optional, so it gets shown from cache immediately and refreshed quietly
 * in the background rather than blocking on the network. */
function isMedia(url) {
  return url.pathname.startsWith('/api/media/') || url.pathname.startsWith('/uploads/');
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Three strategies, picked by what the URL can promise.
//
// This used to be network-first for everything, which quietly made a bad
// connection worse: with a perfectly good cached copy of an immutable file in
// hand, it would still wait for the network before using it, and only fall
// back once the request had failed outright. On a slow-but-alive connection —
// the common case, and the one that matters here — that's the whole latency
// of the page paid again on every visit.
//
// Cross-origin requests (fonts, maps, Razorpay) are left alone entirely.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first: hashed build output. Answer instantly, never revalidate.
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
      )
    );
    return;
  }

  // Stale-while-revalidate: images and video. Show what we have, quietly
  // fetch a fresh copy for next time. Range requests are skipped — a 206 is a
  // slice, not the resource, and caching one would corrupt playback.
  if (isMedia(url) && !request.headers.has('range')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Everything else that isn't the API: network-first, so a deploy is picked
  // up immediately, with the cache as the offline fallback.
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Western Gods Organics', body: '', url: '/' };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // ignore malformed payloads
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      image: data.image || undefined,
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
