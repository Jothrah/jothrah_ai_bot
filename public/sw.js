const CACHE_NAME = "jothrah-admin-pwa-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  return;
});

self.addEventListener("push", (event) => {
  let data = {
    title: "محادثة جديدة في جذرة",
    body: "افتح لوحة المحادثات للرد.",
    url: "/admin/conversations"
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/admin-192.png",
      badge: "/icons/admin-192.png",
      data: {
        url: data.url || "/admin/conversations"
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/admin/conversations";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/admin/conversations") && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});