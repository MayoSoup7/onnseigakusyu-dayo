const C='eigomimi-v14-cache-1';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icon.png'])))});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==C&&k.startsWith('eigomimi-v'))await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
