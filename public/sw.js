/* Offline availability is earned by successful caching, never assumed. */
const CACHE = "30hours-shell-v1";
const SHELL = ["/manifest.webmanifest", "/icon.svg", "/demo/manifest.json"];
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    const response = await fetch(new Request("/", { cache: "reload" }));
    if (!response.ok) throw new Error("The app shell could not be cached.");
    const html = await response.clone().text();
    await cache.put("/", response);
    const assets = [...new Set(html.match(/\/_next\/static\/[^\s"'<>\\]+\.(?:js|css)(?:\?[^\s"'<>\\]*)?/g) || [])].map((path) => path.replaceAll("&amp;", "&"));
    await cache.addAll(assets);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("30hours-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) {
          const snapshot = response.clone();
          event.waitUntil(cache.put(url.pathname, snapshot));
        }
        return response;
      } catch {
        const saved = await cache.match(url.pathname) || await cache.match("/demo") || await cache.match("/");
        return saved || new Response("<!doctype html><html lang='en'><meta name='viewport' content='width=device-width'><title>30hours · offline</title><body style='font:18px system-ui;padding:2rem;background:#fff9f1;color:#27211c'><h1>You’re offline</h1><p>Open 30hours once while connected to cache the app. Download an episode before your next trip.</p></body></html>", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }
  // Next.js RSC payloads depend on router headers. Cache complete documents only.
  if (request.headers.has("RSC") || url.searchParams.has("_rsc")) return;
  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/demo/") || /\.(?:css|js|woff2?|svg|png|webp|ico|webmanifest)$/.test(url.pathname);
  if (!isStatic) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type !== "opaque") event.waitUntil(cache.put(request, response.clone()));
    return response;
  })());
});
