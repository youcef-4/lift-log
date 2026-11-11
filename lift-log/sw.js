// Lift Log offline cache. Bump VERSION whenever the app files change.
const VERSION = "lift-log-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];
const FONT_CACHE = "lift-log-fonts";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts: serve from cache, refresh in the background.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const fresh = fetch(req).then((res) => { cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || fresh;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Pages: try the network first so updates arrive, fall back to the cached app offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("./index.html", copy)); return res; })
        .catch(() => caches.match("./index.html", { ignoreSearch: true }))
    );
    return;
  }

  // Everything else (icons, manifest): cache first.
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
