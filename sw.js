// Netaisyklingieji — veikimas be interneto.
// Pakeitus žaidimą, padidink versijos numerį, kad telefonai gautų naują versiją.
const VERSION = "v8";
const CACHE = "netaisyklingieji-" + VERSION;
const FONTS = "netaisyklingieji-fonts";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Pats žaidimas: kai yra internetas, imama naujausia versija; be interneto – išsaugota.
  if (url.origin === self.location.origin && (req.mode === "navigate" || /\/(index\.html)?$/.test(url.pathname))) {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        const hit = await cache.match(req, { ignoreSearch: true }) || await cache.match("./index.html");
        const fresh = fetch(req, { cache: "no-cache" })
          .then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
        if (!hit) return fresh;
        const timeout = new Promise(res => setTimeout(() => res(hit), 3500));
        return Promise.race([fresh.catch(() => hit), timeout]);
      })
    );
    return;
  }

  // Kiti žaidimo failai (piktogramos ir pan.): rodoma išsaugota versija, o fone atnaujinama.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        const hit = await cache.match(req, { ignoreSearch: true });
        const fresh = fetch(req, { cache: "no-cache" })
          .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
          .catch(() => hit);
        return hit || fresh;
      })
    );
    return;
  }

  // Šriftai iš Google Fonts: išsaugomi po pirmo atidarymo.
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    event.respondWith(
      caches.open(FONTS).then(async cache => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          cache.put(req, res.clone());
          return res;
        } catch (e) {
          return Response.error();
        }
      })
    );
  }
});
