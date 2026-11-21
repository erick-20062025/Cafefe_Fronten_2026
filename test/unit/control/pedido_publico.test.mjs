import assert from "node:assert/strict";
import { test } from "node:test";
import PedidoPublicoService from "../../../src/control/pedido-publico-service.js";
import { armarPedido, categoriasActivas, fotoDeCategoria, fotoDeProducto, precioEnCentavos, totalEstimado } from "../../../src/entity/pedido-publico-model.js";

test("el catálogo muestra directamente las categorías activas del backend", () => {
    const cafe = { nombre: "Café", activo: true };
    const postres = { nombre: "Postres", activo: true };
    const categorias = [cafe, { nombre: "Cafés fríos", activo: false }, postres];
    assert.deepEqual(categoriasActivas(categorias), [cafe, postres]);
    assert.deepEqual(categoriasActivas([]), []);
});

test("el pedido incluye solo nombre, UUID de productos y cantidades", () => {
    const carrito = new Map([["producto-1", { nombre: "Café", cantidad: 2, precio: 3 }]]);
    assert.deepEqual(armarPedido("  Ana  ", carrito), {
        nombreCliente: "Ana",
        productos: [{ idProducto: "producto-1", cantidad: 2 }],
    });
});

test("rechaza un nombre vacío, largo o con caracteres de control", () => {
    const carrito = new Map([["producto-1", { cantidad: 1 }]]);
    for (const nombre of ["    ", "\u200B", "A".repeat(101), "A\u0000na"]) {
        assert.throws(() => armarPedido(nombre, carrito), /nombre válido/);
    }
});

test("rechaza un pedido vacío y las cantidades fuera de rango", () => {
    assert.throws(() => armarPedido("Ana", new Map()), /al menos un producto/);
    for (const cantidad of [0, -1, 1.5, "2", 21]) {
        assert.throws(() => armarPedido("Ana", new Map([["producto-1", { cantidad }]])), /1 y 20 unidades/);
    }
    const carrito = new Map(Array.from({ length: 5 }, (_, i) => [String(i), { cantidad: 20 }]));
    assert.equal(armarPedido("Ana", carrito).productos.length, 5);
    carrito.set("6", { cantidad: 1 });
    assert.throws(() => armarPedido("Ana", carrito), /100 unidades/);
});

test("envía JSON por POST a la ruta pública confirmada en el backend", async () => {
    const pedido = { nombreCliente: "Ana", productos: [{ idProducto: "producto-1", cantidad: 1 }] };
    const servicio = new PedidoPublicoService({
        api: {
            solicitarJson: async (ruta, opciones) => {
                assert.equal(ruta, "ordenes/publicas");
                assert.deepEqual(opciones, { metodo: "POST", datos: pedido });
                return { idOrden: "orden-1" };
            },
        },
    });
    assert.deepEqual(await servicio.enviar(pedido), { idOrden: "orden-1" });
});

test("usa los tipos de producto y consulta únicamente los productos asociados", async () => {
    const idCategoria = "a042c019-3acb-45f1-b475-765e1239d884";
    const tipo = { idTipoProducto: idCategoria, nombre: "Café caliente", activo: true };
    const cafe = { idProducto: "producto-1", activo: true, precioSugerido: 2.5 };
    const rutaRelaciones = `producto-tipos-producto/tipos-producto/${idCategoria}`;
    const respuestas = new Map([
        ["tipos-producto", [tipo]],
        [rutaRelaciones, [{ idProducto: cafe.idProducto }, { idProducto: { idProducto: cafe.idProducto } }]],
        ["productos/producto-1", cafe],
    ]);
    const llamadas = [];
    const api = { solicitarJson: async ruta => {
        llamadas.push(ruta);
        assert.ok(respuestas.has(ruta), `Ruta inesperada: ${ruta}`);
        return respuestas.get(ruta);
    } };
    const servicio = new PedidoPublicoService({ api });

    assert.deepEqual(await servicio.listarCategorias(), [tipo]);
    assert.deepEqual(await servicio.listarProductos(idCategoria), [cafe]);
    assert.deepEqual(llamadas, ["tipos-producto", rutaRelaciones, "productos/producto-1"]);

    respuestas.set(rutaRelaciones, []);
    llamadas.length = 0;
    assert.deepEqual(await servicio.listarProductos(idCategoria), []);
    assert.deepEqual(llamadas, [rutaRelaciones]);
});

test("muestra un error si las consultas de catálogo no devuelven listas", async () => {
    const servicio = new PedidoPublicoService({ api: { solicitarJson: async () => ({}) } });
    await assert.rejects(servicio.listarCategorias(), /lista de categorías/);
    await assert.rejects(servicio.listarProductos("categoria-1"), /asociaciones del tipo/);
});

test("detecta una relación sin ID antes de consultar productos", async () => {
    const servicio = new PedidoPublicoService({ api: { solicitarJson: async () => [{ idProducto: null }] } });
    await assert.rejects(servicio.listarProductos("categoria-1"), /identificador de producto válido/);
});

test("acepta imágenes del API o embebidas y descarta las de otros orígenes", () => {
    const servicio = new PedidoPublicoService({ api: { urlApi: "http://localhost:9080/cafefe/api/" } });
    assert.equal(servicio.urlImagen("/cafefe/fotos/cafe.png"), "http://localhost:9080/cafefe/fotos/cafe.png");
    assert.equal(servicio.urlImagen("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
    assert.equal(servicio.urlImagen("/9j/" + "A".repeat(36)), "data:image/jpeg;base64,/9j/" + "A".repeat(36));
    for (const ruta of [null, "", "https://otro.example/cafe.png", "javascript:alert(1)"]) {
        assert.equal(servicio.urlImagen(ruta), null);
    }
});

test("asocia los JPG a las cuatro categorías y usa una foto general para otras", () => {
    assert.equal(fotoDeCategoria("Café caliente"), "bebidas-calientes.jpg");
    assert.equal(fotoDeCategoria(" CAFÉ HELADO "), "bebidas-frias.jpg");
    assert.equal(fotoDeCategoria("Comida"), "comida.jpg");
    assert.equal(fotoDeCategoria("Postres"), "postres.jpg");
    assert.equal(fotoDeCategoria("Otras bebidas"), "categoria-cafefe.webp");
});

test("el total estimado suma unidades con precisión y requiere todos los precios", () => {
    const carrito = new Map([
        ["1", { cantidad: 3, precioCentavos: precioEnCentavos("0.10") }],
        ["2", { cantidad: 1, precioCentavos: precioEnCentavos("2.95") }],
    ]);
    assert.equal(totalEstimado(carrito), 3.25);
    assert.equal(precioEnCentavos(0), 0);
    for (const valor of [undefined, null, "", "0.101", true, -1]) {
        assert.equal(precioEnCentavos(valor), null);
    }
    carrito.set("3", { cantidad: 1, precioCentavos: null });
    assert.equal(totalEstimado(carrito), null);
});

test("reutiliza fotos locales por nombre del producto y recurre a su tipo", () => {
    assert.equal(fotoDeProducto(" Cafe  Americano ", "Café caliente"), "productos/americano.jpg");
    assert.equal(fotoDeProducto("Latte elado", "Café helado"), "productos/latte-helado.jpg");
    assert.equal(fotoDeProducto("FRAPPÉ DE CARAMELO", "Café helado"), "productos/frappe-caramelo.jpg");
    assert.equal(fotoDeProducto("Americano Elado", "Café helado"), "productos/americano-helado.jpg");
    assert.equal(fotoDeProducto("Cafe Caramelo", "Café helado"), "productos/cafe-caramelo.jpg");
    assert.equal(fotoDeProducto("Budin de Caramelo", "Postres"), "productos/budin-caramelo.jpg");
    assert.equal(fotoDeProducto("Pai de Piña", "Postres"), "productos/pai-pina.jpg");
    assert.equal(fotoDeProducto("Producto nuevo", "Comida"), "comida.jpg");
});
