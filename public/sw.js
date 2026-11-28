// One-release cleanup worker for retiring the previous offline app shell.
// Keep this file at /sw.js so returning browsers receive it as an update.
function isMaribAppCache(name) {
  return /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-|^(html-pages|app-assets|images|supabase-data|supabase-images|gfonts-css|gfonts-files)$/.test(
    name,
  );
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const appCaches = cacheNames.filter(isMaribAppCache);
      await Promise.allSettled(appCaches.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});
