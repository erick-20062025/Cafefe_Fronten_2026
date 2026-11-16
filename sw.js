const CACHE = 'cafefe-shell-v16';
const RECURSOS = [
    './index.html', './src/entity/detalle_orden.js', './src/recursos/imagenes/marca/200LogoCafefe.png', './manifest.webmanifest',
    './src/boundary/app.js', './src/boundary/login-view.js', './src/boundary/recepcion-view.js',
    './src/boundary/cobros-view.js', './src/recursos/estilos/cobros.css',
    './src/control/default_service.js', './src/control/sesion_service.js', './src/control/acceso.js', './src/control/recepcion.js', './src/control/pwa.js', './src/control/navegacion.js',
    './src/boundary/pedido_publico.js', './src/control/pedido_publico_service.js', './src/entity/pedido_publico.js',
    './src/recursos/estilos/pedido_publico.css',
    './src/recursos/imagenes/bebidas-calientes.jpg', './src/recursos/imagenes/bebidas-frias.jpg',
    './src/recursos/imagenes/comida.jpg', './src/recursos/imagenes/postres.jpg', './src/recursos/imagenes/categoria-cafefe.webp',
    './src/recursos/imagenes/productos/americano-helado.jpg', './src/recursos/imagenes/productos/americano.jpg',
    './src/recursos/imagenes/productos/brownie.jpg', './src/recursos/imagenes/productos/capuchino.jpg',
    './src/recursos/imagenes/productos/croissant-jamon-queso.jpg', './src/recursos/imagenes/productos/flan.jpg',
    './src/recursos/imagenes/productos/frappe-caramelo.jpg', './src/recursos/imagenes/productos/latte-helado.jpg',
    './src/recursos/imagenes/productos/mocha.jpg', './src/recursos/imagenes/productos/panini-pavo.jpg',
    './src/recursos/imagenes/productos/pie.jpg', './src/recursos/imagenes/productos/sandwich-pollo.jpg',
    './src/recursos/imagenes/productos/cafe-caramelo.jpg', './src/recursos/imagenes/productos/budin-caramelo.jpg',
    './src/recursos/imagenes/productos/pai-pina.jpg',
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
