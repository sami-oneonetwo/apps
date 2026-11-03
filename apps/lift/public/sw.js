// Offline support: serve the app from cache, refresh it in the background.
// /api/* always goes to the network (the app queues changes itself when offline).

const CACHE = "lift-shell-v4";
const SHELL = [
  "/", "/index.html", "/app.css", "/manifest.webmanifest",
  "/js/app.js", "/js/store.js", "/js/seed.js", "/js/progression.js", "/js/plates.js", "/js/program.js", "/js/body.js", "/js/anim.js", "/js/motions.js",
  "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(SHELL.map((u) => fetch(u, { credentials: "same-origin" }).then((r) => good(r) && c.put(u, r)).catch(() => {}))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lift-") && k !== CACHE && k !== "lift-fonts").map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Don't cache Cloudflare Access login redirects or errors.
const good = (r) => r && r.ok && !r.redirected && (r.type === "basic" || r.type === "cors");

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/cdn-cgi/")) return;
    if (req.mode === "navigate") {
      e.respondWith(networkFirstPage(req));
      return;
    }
    e.respondWith(staleWhileRevalidate(CACHE, url.pathname, req));
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(staleWhileRevalidate("lift-fonts", req.url, req));
  }
});

async function staleWhileRevalidate(cacheName, key, req) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(key);
  const net = fetch(req)
    .then((r) => { if (good(r)) cache.put(key, r.clone()); return r; })
    .catch(() => null);
  return hit || (await net) || new Response("Offline and not cached yet. Open Lift once with a connection.", { status: 503 });
}

// Pages: go to the network first so Cloudflare Access can show its sign-in page
// when the session has expired. Fall back to the cached app only when offline.
async function networkFirstPage(req) {
  try {
    const r = await fetch(req);
    if (r.type === "opaqueredirect" || r.redirected || r.status === 401 || r.status === 403) return r;
    if (r.ok) (await caches.open(CACHE)).put("/", r.clone());
    return r;
  } catch {
    return (await caches.match("/", { cacheName: CACHE })) || new Response("Offline and not cached yet. Open Lift once with a connection.", { status: 503 });
  }
}
