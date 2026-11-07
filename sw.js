// ============================================================================
// SERVICE WORKER (sw.js)
// Lets the board open without Wi-Fi, and lets Chrome offer "Install app".
//
// - Pages (index.html): network first, so a new deploy shows straight away;
//   the saved copy is only used when there's no connection.
// - App files (js, css, icons) and the Firebase / font / confetti libraries:
//   served from the saved copy and refreshed in the background. Files are
//   loaded with ?v=N, so a deploy that bumps N is always fetched fresh.
// - Everything else (Firestore data, weather, AI) is never touched here.
// ============================================================================
const CACHE = "harmonee-v1";
const LIBRARY_HOSTS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "unpkg.com"];
const STATIC_EXT = /\.(?:js|css|png|jpg|jpeg|svg|webp|ico|woff2?|webmanifest|json)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Keep one copy per file: saving app.js?v=231 drops app.js?v=230
async function putLatest(cache, request, response) {
  const url = new URL(request.url);
  if (url.search) {
    const old = await cache.keys();
    await Promise.all(old.filter(r => {
      const u = new URL(r.url);
      return u.origin === url.origin && u.pathname === url.pathname && u.search !== url.search;
    }).map(r => cache.delete(r)));
  }
  await cache.put(request, response);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // The page itself: network first, saved copy when offline (any ?board=...)
  if (req.mode === "navigate" && sameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put("/", fresh.clone());
        return fresh;
      } catch (err) {
        return (await cache.match("/")) || Response.error();
      }
    })());
    return;
  }

  const isAppFile = sameOrigin && STATIC_EXT.test(url.pathname) && url.pathname !== "/sw.js";
  const isLibrary = LIBRARY_HOSTS.includes(url.hostname);
  if (!isAppFile && !isLibrary) return; // data, weather, AI: straight to the network

  // Files without a ?v= (e.g. modules imported by other modules): network
  // first, so they can never be older than the files that load them
  if (isAppFile && !url.search) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        return (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }

  // Versioned files and libraries: saved copy straight away, refreshed in the background
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const refresh = fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) putLatest(cache, req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(refresh); return cached; }
    return (await refresh) || Response.error();
  })());
});
