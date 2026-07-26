/* CookBook service worker — network-first so deploys show up */
// Bump CACHE on every release so old shells are dropped.
const CACHE = "cookbook-shell-v3";
const PRECACHE = ["/manifest.webmanifest", "/icon.svg", "/icon-maskable.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API / media / health — always network (no SW intercept)
  if (
    url.pathname.startsWith("/v1/") ||
    url.pathname.startsWith("/media/") ||
    url.pathname.startsWith("/healthz") ||
    url.pathname.startsWith("/readyz") ||
    url.pathname.includes("catalog.json") ||
    url.pathname === "/sw.js"
  ) {
    return;
  }

  // HTML navigations + hashed assets: network-first, cache as fallback only
  const isNavigate = req.mode === "navigate";
  const isAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".html") ||
    url.pathname === "/";

  if (isNavigate || isAsset) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => {
              // Prefer storing index under a stable key for offline shell
              if (isNavigate || url.pathname === "/" || url.pathname === "/index.html") {
                c.put("/index.html", copy.clone());
              }
              c.put(req, copy);
            });
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("/index.html")),
        ),
    );
    return;
  }

  // Icons / misc: cache-first
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
