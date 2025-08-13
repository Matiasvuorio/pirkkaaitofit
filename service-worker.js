// ---- Pirkka AitoFit - Service Worker (network-first navigations, SWR for assets) ----
// BUMP THIS ON EACH DEPLOY:
const CACHE_PREFIX  = 'gym-cache';
const CACHE_VERSION = 'v3'; // <- nosta versio numeroa uuden deployn yhteydessä
const RUNTIME_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}`;

// Optional: loggaa versio konsoliin
self.addEventListener('install', (event) => {
  // Päivitä heti uuteen SW-versioon
  self.skipWaiting();
  event.waitUntil((async () => {
    try {
      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable();
      }
    } catch (_) {}
  })());
});

self.addEventListener('activate', (event) => {
  // Poista vanhat cachet ja ota uusi heti käyttöön
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
    } catch (_) {}
    await self.clients.claim();
  })());
});

// Vastaanota manuaalinen ohitus (jos joskus haluat kutsua postMessage('SKIP_WAITING'))
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Apuri: onko sama origin?
function sameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

// Fallback, jos ollaan offline eikä cacheakaan löydy
function offlineResponse() {
  return new Response('Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1) HTML-navigaatiot: NETWORK-FIRST (+ navigation preload)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Navigation preload (jos päällä) on nopea
        const preload = await event.preloadResponse;
        if (preload) {
          // Päivitä cache taustalla
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put('/', preload.clone()).catch(() => {});
          return preload;
        }

        // Normaali verkko
        const networkResp = await fetch(req);
        // Cacheta juureen tai polkuun (varovainen mappaus)
        const cacheKey = url.pathname === '/' ? '/' : url.pathname;
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(cacheKey, networkResp.clone()).catch(() => {});
        return networkResp;
      } catch {
        // Verkko epäonnistui → koita cachea
        const cache = await caches.open(RUNTIME_CACHE);
        // Yritä ensin täsmäpolkua, sitten juurta
        const cached =
          (await cache.match(url.pathname)) ||
          (await cache.match('/'));
        return cached || offlineResponse();
      }
    })());
    return;
  }

  // 2) Samadomainin staattiset assetit: STALE-WHILE-REVALIDATE
  if (sameOrigin(req)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((resp) => {
          // Vain onnistuneet vastaukset talteen
          if (resp && resp.status === 200) {
            cache.put(req, resp.clone()).catch(() => {});
          }
          return resp;
        })
        .catch(() => null);
      // Palauta cache heti jos löytyy, muuten odota verkkoa
      return cached || (await fetchPromise) || offlineResponse();
    })());
    return;
  }

  // 3) Kolmannen osapuolen pyynnöt: NETWORK-FIRST, fallback cacheen jos sellainen on
  event.respondWith((async () => {
    try {
      return await fetch(req);
    } catch {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      return cached || offlineResponse();
    }
  })());
});
