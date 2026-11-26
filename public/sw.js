const CACHE_NAME = "jothrah-admin-pwa-v2";

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
      const section = targetUrl.includes("/admin/bookings") ? "/admin/bookings" : "/admin/conversations";
      for (const client of clients) {
        if (client.url.includes(section) && "focus" in client) {
          if (targetUrl.includes("?") && "navigate" in client) {
            return client.navigate(targetUrl).then((c) => (c || client).focus());
          }
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});