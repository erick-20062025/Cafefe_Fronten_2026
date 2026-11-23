// Transición de las instalaciones anteriores al Document Root autónomo src.
// No borra catálogos, almacenamiento de usuario ni cachés de otros alcances.
const prefijo = 'cafefe-shell-' + encodeURIComponent(new URL('./', self.location.href).pathname) + '-';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
    for (const nombre of await caches.keys()) {
        if (nombre.startsWith(prefijo) || (new URL(self.location.href).pathname === '/sw.js' && /^cafefe-shell-v\d+$/.test(nombre))) await caches.delete(nombre);
    }
    await self.clients.claim();
})()));
