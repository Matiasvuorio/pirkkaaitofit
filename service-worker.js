self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('gym-minimal-fi-v99').then(cache => cache.addAll([
      './',
      './index.html',
      './manifest.webmanifest',
      './service-worker.js',
      './assets/icon-192.png',
      './assets/icon-512.png'
    ]))
  );
  self.skipWaiting();
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (e)=>{
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request))
  );
});