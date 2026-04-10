/// BarnBook Service Worker
/// Handles caching, offline fallback, and push notification scaffolding

const CACHE_NAME = "barnbook-v3";
const OFFLINE_URL = "/offline";

// Pre-cache the offline page on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/logo.png",
      ]);
    })
  );
  self.skipWaiting();
});

// Clean up old caches on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch handler with caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip Supabase auth/realtime requests — never cache authenticated data
  if (url.hostname.includes("supabase") && (url.pathname.includes("/auth/") || url.pathname.includes("/realtime/"))) {
    return;
  }

  // Strategy 1: CacheFirst for static assets (JS, CSS, fonts, images)
  if (
    url.pathname.match(/\/_next\/static\//) ||
    url.pathname.match(/\.(js|css|woff2?|ttf|eot)$/) ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Strategy 2: CacheFirst for Supabase Storage images (horse photos, etc.)
  if (url.hostname.includes("supabase") && url.pathname.includes("/storage/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Strategy 3: NetworkFirst for HTML pages with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful page responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Try cache, then offline fallback
          return caches.match(request).then((cached) => {
            return cached || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // Strategy 4: NetworkFirst for API/data requests (3s timeout)
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase")) {
    event.respondWith(
      Promise.race([
        fetch(request),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
      ])
        .then((response) => {
          // Don't cache user-specific API data to prevent data leaks
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || new Response(JSON.stringify({ error: "offline" }), {
              headers: { "Content-Type": "application/json" },
              status: 503,
            });
          });
        })
    );
    return;
  }

  // Default: NetworkFirst
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ─── Push Notification Scaffolding ───
// TODO: Implement push notification backend with Web Push API + VAPID keys
// When ready, the backend will send push events and this handler will show notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "You have a new notification",
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-32.png",
      vibrate: [100, 50, 100],
      data: {
        url: data.url || "/dashboard",
      },
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "BarnBook", options)
    );
  } catch (e) {
    // Fallback for non-JSON push data
    event.waitUntil(
      self.registration.showNotification("BarnBook", {
        body: event.data.text(),
        icon: "/icons/icon-192.png",
      })
    );
  }
});

// Handle notification click — open the URL from the notification data
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // Focus existing window if one exists
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});
