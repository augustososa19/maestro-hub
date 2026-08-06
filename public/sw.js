self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() };
  }

  const title = payload.title || "MusicCRM";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "Você tem um lembrete.",
      icon: "/app-icon-192.png",
      badge: "/notification-badge.png",
      tag: payload.tag || "musiccrm-reminder",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        return existing.navigate(target).then((client) => client?.focus());
      }
      return self.clients.openWindow(target);
    }),
  );
});
