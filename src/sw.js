const BASE = new URL('./', self.location.href);
const PREFIJO = 'cafefe-shell-' + encodeURIComponent(BASE.pathname) + '-';
const CACHE = PREFIJO + 'v30';
const CONFIG = new URL('./config/api.js', BASE).href;
const RECURSOS = [
    './control/monitor_conexion.js', './config/api.js', './control/recepcion-service.js', './entity/preparacion-local.js', './control/listados-cobros.js',
    './control/catalogo_offline.js', './control/menu_movil.js', './recursos/imagenes/fondo-cafe.png',
    './index.html', './entity/detalle_orden.js', './recursos/imagenes/marca/200LogoCafefe.png', './manifest.webmanifest',
    './boundary/app.js', './boundary/login-view.js', './boundary/recepcion-view.js',
    './boundary/cobros-view.js', './recursos/estilos/cobros.css',
    './control/default_service.js', './control/sesion_service.js', './control/acceso.js', './control/recepcion.js', './control/pwa.js', './control/navegacion.js',
    './boundary/pedido-publico-view.js', './control/pedido-publico-service.js', './entity/pedido-publico-model.js',
    './recursos/estilos/pedido_publico.css',
    './recursos/imagenes/bebidas-calientes.jpg', './recursos/imagenes/bebidas-frias.jpg',
    './recursos/imagenes/comida.jpg', './recursos/imagenes/postres.jpg', './recursos/imagenes/categoria-cafefe.webp',
    './recursos/imagenes/productos/americano-helado.jpg', './recursos/imagenes/productos/americano.jpg',
    './recursos/imagenes/productos/brownie.jpg', './recursos/imagenes/productos/capuchino.jpg',
    './recursos/imagenes/productos/croissant-jamon-queso.jpg', './recursos/imagenes/productos/flan.jpg',
    './recursos/imagenes/productos/frappe-caramelo.jpg', './recursos/imagenes/productos/latte-helado.jpg',
    './recursos/imagenes/productos/mocha.jpg', './recursos/imagenes/productos/panini-pavo.jpg',
    './recursos/imagenes/productos/pie.jpg', './recursos/imagenes/productos/sandwich-pollo.jpg',
    './recursos/imagenes/productos/cafe-caramelo.jpg', './recursos/imagenes/productos/budin-caramelo.jpg',
    './recursos/imagenes/productos/pai-pina.jpg',
    './entity/default_error.js', './recursos/estilos/principal.css', './recursos/estilos/personal.css',
    './recursos/iconos/icon-192.png', './recursos/iconos/icon-512.png',
    "./recursos/imagenes/merch.jpeg",
"./recursos/imagenes/productos/vaso-coleccionable.jpeg"
];
const PERMITIDOS = new Set(RECURSOS.map(ruta => new URL(ruta, BASE).href));
self.addEventListener('install', event => event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([...PERMITIDOS]);
    // Activar los recursos nuevos sin recargar formularios ni cobros en curso.
    await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
    for (const nombre of await caches.keys()) if (nombre !== CACHE && (nombre.startsWith(PREFIJO)
        || (BASE.pathname === '/' && /^cafefe-shell-v\d+$/.test(nombre)))) await caches.delete(nombre);
    await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    url.hash = "";
    // Lista cerrada: ninguna API, credencial, querystring o recurso externo se guarda.
    if (url.origin !== BASE.origin || url.search) return;
    if (url.href === CONFIG) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE);
            try {
                const respuesta = await fetch(request, {cache: 'no-store'});
                if (respuesta.ok) await cache.put(CONFIG, respuesta.clone());
                return respuesta;
            } catch (error) {
                const guardada = await cache.match(CONFIG);
                if (guardada) return guardada;
                throw error;
            }
        })());
        return;
    }
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
