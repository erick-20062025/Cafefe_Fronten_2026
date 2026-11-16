/** Rutas hash de la SPA; no consulta ni concede permisos de servidor. */
export function resolverRuta(hash, acceso) {
    const ruta = hash === '' || hash === '#/' ? 'pedido' : hash.startsWith('#/') ? hash.slice(2) : 'no-encontrada';
    if (['recepcion', 'cobros'].includes(ruta)) return acceso.solicitar(ruta);
    return ['pedido', 'mis-ordenes', 'login'].includes(ruta) ? ruta : 'no-encontrada';
}
