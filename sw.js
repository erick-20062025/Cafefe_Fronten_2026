const CACHE = 'cafefe-shell-v2';
const RECURSOS = [
    './index.html', './manifest.webmanifest',
    './src/boundary/app.js', './src/boundary/login-view.js', './src/boundary/recepcion-view.js',
    './src/control/default_service.js', './src/control/acceso.js', './src/control/recepcion.js', './src/control/pwa.js', './src/control/navegacion.js',
    './src/entity/default_error.js', './src/recursos/estilos/principal.css', './src/recursos/estilos/personal.css',
    './src/recursos/iconos/icon-192.png', './src/recursos/iconos/icon-512.png'
];
const BASE = new URL('./', self.location.href);
const PERMITIDOS = new Set(RECURSOS.map(ruta => new URL(ruta, BASE).href));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...PERMITIDOS]))));
// No skipWaiting: una versión nueva toma control al cerrar todas las pestañas anteriores.
self.addEventListener('activate', event => event.waitUntil((async () => {
    for (const nombre of await caches.keys()) if (nombre.startsWith('cafefe-shell-') && nombre !== CACHE) await caches.delete(nombre);
    await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    url.hash = "";
    // Lista cerrada: ninguna API, credencial, querystring o recurso externo se guarda.
    if (url.origin !== BASE.origin || url.search) return;
    const esEntrada = request.mode === 'navigate' && (url.href === BASE.href || url.href === new URL('index.html', BASE).href);
    if (!esEntrada && !PERMITIDOS.has(url.href)) return;
    const clave = esEntrada ? new URL('index.html', BASE).href : url.href;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const disponible = await cache.match(clave);
        if (disponible) return disponible;
        return fetch(request);
    })());
});
