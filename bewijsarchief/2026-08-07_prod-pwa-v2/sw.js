// Sparki service worker — Web Push + PWA app-shell-cache (RIJDEN_01 §7).
//
// App-shell: de schil (index + manifest + iconen + kaartstijl) staat in een
// versie-genummerde cache zodat de app als beginscherm-app snel opent.
// Versiecontrole: een nieuwe SW-versie (CACHE_VERSIE opgehoogd bij release)
// gooit oude caches weg in activate — er blijft nooit een oude schil hangen.
// Netwerk wint altijd (network-first): de cache is alleen het vangnet voor
// offline/flaky verbindingen; API-verkeer wordt NOOIT gecachet.
const CACHE_VERSIE = "sparki-shell-v2";
const SHELL_BESTANDEN = [
  "./",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "kaart/sparki-stijl.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSIE)
      .then((cache) =>
        Promise.allSettled(
          SHELL_BESTANDEN.map((p) =>
            cache.add(new URL(p, self.registration.scope)),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) =>
        Promise.all(
          namen
            .filter((n) => n.startsWith("sparki-shell-") && n !== CACHE_VERSIE)
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Alleen eigen origin en nooit API-verkeer — data moet altijd vers en
  // eerlijk zijn, een verouderd antwoord uit cache is erger dan een fout.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;
  const isNavigatie = req.mode === "navigate";
  const isShell = SHELL_BESTANDEN.some(
    (p) => new URL(p, self.registration.scope).pathname === url.pathname,
  );
  if (!isNavigatie && !isShell) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const kopie = res.clone();
          caches.open(CACHE_VERSIE).then((c) => c.put(req, kopie));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(
          (hit) =>
            hit ||
            (isNavigatie
              ? caches.match(new URL("./", self.registration.scope))
              : undefined),
        ),
      ),
  );
});
//
// A push reaches the athlete's phone lock screen (mirrored on a paired watch)
// even when the app is closed. The notification itself can never hold an input
// field, so tapping it opens the app at ONE focused question (e.g.
// "/you?focus=ftp"). URLs are resolved against the registration scope so they
// keep working under a base-path prefix.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_err) {
    payload = {};
  }

  const title = payload.title || "Sparki";
  const body = payload.body || "";
  const url = typeof payload.url === "string" ? payload.url : "/";
  const tag = payload.tag || undefined;

  const options = {
    body,
    tag,
    data: { url },
    icon: new URL("icon-192.png", self.registration.scope).href,
    badge: new URL("icon-192.png", self.registration.scope).href,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const raw =
    event.notification.data && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/";
  // Resolve against the scope so a base-path prefix is honoured. Strip any
  // leading slash so the path is treated as scope-relative, not host-root.
  const target = new URL(raw.replace(/^\//, ""), self.registration.scope).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          // Reuse an already-open app window when one exists.
          if ("focus" in client) {
            if ("navigate" in client && client.url !== target) {
              return client.navigate(target).then((c) => c && c.focus());
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
        return undefined;
      }),
  );
});
