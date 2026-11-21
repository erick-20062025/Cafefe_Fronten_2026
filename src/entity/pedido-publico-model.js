export const MAX_CANTIDAD = 20;
export const MAX_UNIDADES = 100;
export const MAX_NOMBRE = 100;

export function categoriasActivas(categorias) {
    return categorias.filter(categoria => categoria.activo === true);
}

const fotosPorCategoria = new Map([
    ["cafe caliente", "bebidas-calientes.jpg"],
    ["bebidas calientes", "bebidas-calientes.jpg"],
    ["cafe helado", "bebidas-frias.jpg"],
    ["bebidas frias", "bebidas-frias.jpg"],
    ["bebidas heladas", "bebidas-frias.jpg"],
    ["comida", "comida.jpg"],
    ["alimento", "comida.jpg"],
    ["postres", "postres.jpg"],
    ["merch", "merch.jpeg"],
]);

function normalizarNombre(nombre) {
    return nombre.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ");
}

export function fotoDeCategoria(nombre) {
    return fotosPorCategoria.get(normalizarNombre(nombre)) ?? "categoria-cafefe.webp";
}

const fotosPorProducto = new Map([
    ["cafe americano", "americano.jpg"],
    ["capuchino", "capuchino.jpg"],
    ["mocha caliente", "mocha.jpg"],
    ["latte elado", "latte-helado.jpg"],
    ["latte helado", "latte-helado.jpg"],
    ["americano helado", "americano-helado.jpg"],
    ["americano elado", "americano-helado.jpg"],
    ["cafe caramelo", "cafe-caramelo.jpg"],
    ["frappe de caramelo", "frappe-caramelo.jpg"],
    ["sandwich de pollo", "sandwich-pollo.jpg"],
    ["croissant de jamon y queso", "croissant-jamon-queso.jpg"],
    ["panini de pavo", "panini-pavo.jpg"],
    ["pai", "pie.jpg"],
    ["pie", "pie.jpg"],
    ["budin de caramelo", "budin-caramelo.jpg"],
    ["pai de pina", "pai-pina.jpg"],
    ["brownie de chocolate", "brownie.jpg"],
    ["flan de caramelo", "flan.jpg"],
    ["vaso coleccionable", "vaso-coleccionable.jpeg"],
]);

export function fotoDeProducto(nombre, tipo) {
    const foto = fotosPorProducto.get(normalizarNombre(nombre));
    return foto ? "productos/" + foto : fotoDeCategoria(tipo);
}

export function totalUnidades(carrito) {
    return Array.from(carrito.values()).reduce((total, fila) => total + fila.cantidad, 0);
}

export function precioEnCentavos(precio) {
    const texto = String(precio);
    if (!/^\d+(?:\.\d{1,2})?$/.test(texto)) return null;

    const [entero, decimales = ""] = texto.split(".");
    const centavos = Number(entero) * 100 + Number(decimales.padEnd(2, "0"));
    return Number.isSafeInteger(centavos) ? centavos : null;
}

export function totalEstimado(carrito) {
    let total = 0;
    for (const fila of carrito.values()) {
        if (fila.precioCentavos == null) return null;

        total += fila.precioCentavos * fila.cantidad;
    }
    return Number.isSafeInteger(total) ? total / 100 : null;
}

export function armarPedido(nombre, carrito) {
    const nombreCliente = nombre.replace(/^[\s\u200B]+|[\s\u200B]+$/gu, "");
    if (!nombreCliente || nombreCliente.length > MAX_NOMBRE || /\p{Cc}/u.test(nombre)) {
        throw new Error("Escribe un nombre válido de hasta 100 caracteres.");
    }
    if (carrito.size === 0) {
        throw new Error("Agrega al menos un producto.");
    }
    if (totalUnidades(carrito) > MAX_UNIDADES) {
        throw new Error("El pedido admite hasta 100 unidades.");
    }

    const productos = Array.from(carrito, ([idProducto, { cantidad }]) => {
        if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) {
            throw new Error("Cada producto admite entre 1 y 20 unidades.");
        }
        return { idProducto, cantidad };
    });
    return { nombreCliente, productos };
}
