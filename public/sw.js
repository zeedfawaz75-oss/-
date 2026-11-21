// One-release cleanup worker for retiring the previous offline app shell.
// Keep this file at /sw.js so returning browsers receive it as an update.
function isMaribAppCache(name) {
  return /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-|^(html-pages|app-assets|images|supabase-data|supabase-images|gfonts-css|gfonts-files)$/.test(name);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const appCaches = cacheNames.filter(isMaribAppCache);
        await Promise.allSettled(appCaches.map((name) => caches.delete(name)));
        await self.clients.claim();

        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(clients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});