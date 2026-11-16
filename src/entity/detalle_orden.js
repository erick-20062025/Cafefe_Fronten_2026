export function agruparProductos(filas = []) {
    const grupos = new Map();
    for (const fila of filas) {
        const clave = JSON.stringify([fila.idProducto, fila.producto, fila.caracteristicas, fila.precio, fila.precioBase, fila.descuento, fila.observaciones]);
        if (!grupos.has(clave)) grupos.set(clave, {...fila, cantidad:0});
        grupos.get(clave).cantidad++;
    }
    return [...grupos.values()];
}
