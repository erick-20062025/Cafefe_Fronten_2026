import assert from "node:assert/strict";
import { test } from "node:test";
import { Acceso } from "../../src/control/acceso.js";
import { SesionService } from "../../src/control/sesion_service.js";

test("Cobros consulta órdenes pendientes con la sesión del cajero", async t => {
    const main = {
        replaceChildren() { this.vista = null; },
        append(vista) { this.vista = vista; },
    };
    const elementos = new Map();
    for (const [nombre, valor] of Object.entries({
        HTMLElement: class {},
        customElements: { define: (etiqueta, clase) => elementos.set(etiqueta, clase) },
        document: { createElement: etiqueta => ({ etiqueta }) },
        location: { hash: "#/cobros" },
    })) {
        const anterior = Object.getOwnPropertyDescriptor(globalThis, nombre);
        Object.defineProperty(globalThis, nombre, { value: valor, configurable: true, writable: true });
        t.after(() => anterior
            ? Object.defineProperty(globalThis, nombre, anterior)
            : delete globalThis[nombre]);
    }
    const { CafefeApp } = await import("../../src/boundary/app.js");
    assert.ok(elementos.has("cafefe-cobros"));
    const app = new CafefeApp();
    const salir = {};
    app.querySelector = selector => selector === "main" ? main : salir;
    app.querySelectorAll = () => [];
    app.acceso = new Acceso();
    app.acceso.establecer({ nombre: "Caja", activo: true, roles: ["cajero"] });
    const orden = { idOrden: "orden-nueva" };
    const llamadas = [];
    app.sesionApi = new SesionService({ solicitar: async (url, opciones) => {
        llamadas.push({ url, opciones });
        return Response.json([orden]);
    } });

    app.render();

    assert.equal(main.vista.etiqueta, "cafefe-cobros");
    assert.equal(main.vista.servicio, app.sesionApi);
    assert.equal(main.vista.conSesion, true);
    const VistaCobros = elementos.get("cafefe-cobros");
    const vista = new VistaCobros();
    vista.conSesion = main.vista.conSesion;
    vista.servicio = main.vista.servicio;
    vista.querySelector = () => ({ replaceChildren() {}, append() {} });
    vista.filaLista = (_lista, registro) => registro;
    await vista.actualizar();
    assert.equal(llamadas.length, 3);
    assert.deepEqual(llamadas.map(({ url }) => url.split("/api/")[1]).sort(), [
        "cobros/facturas/pagadas", "cobros/facturas/pendientes", "cobros/ordenes-pendientes",
    ]);
    const ordenes = llamadas.find(llamada => llamada.url.endsWith("/cobros/ordenes-pendientes"));
    assert.ok(ordenes);
    assert.equal(new URL(ordenes.url).hostname, "127.0.0.1");
    assert.equal(ordenes.opciones.credentials, "include");
    assert.equal(ordenes.opciones.cache, "no-store");
});
