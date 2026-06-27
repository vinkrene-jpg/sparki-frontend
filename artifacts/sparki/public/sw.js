// Sparki service worker — Web Push only.
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
