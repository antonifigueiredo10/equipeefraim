/* EQUIPE EFRAIM — Service Worker: recebe os lembretes (push) do devocional */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(err){ d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Equipe Efraim", {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/favicon-32.png",
    tag: "devocional",
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: d.url || "/devocional.html" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/devocional.html";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(lista => {
    for(const c of lista){ if(c.url.includes(self.location.origin)){ c.navigate(url); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
