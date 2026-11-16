import assert from "node:assert/strict";
import { test } from "node:test";

class ElementoPrueba {
    children = [];
    dataset = {};
    value = "";
    isConnected = true;

    append(...hijos) { this.children.push(...hijos); }
    replaceChildren(...hijos) { this.children = hijos; }
    add(opcion) { if (!this.value) this.value = opcion.value; }
    querySelector() { return null; }
    removeAttribute(nombre) { this[nombre] = ""; }
    focus() { this.enfocado = true; }
    get valueAsNumber() { return this.value === "" ? NaN : Number(this.value); }
}

async function prepararCobro(t, respuestas, conSesion = false, inicial = resumen(0, 10, false)) {
    const formulario = new ElementoPrueba();
    const monto = new ElementoPrueba();
    const metodo = new ElementoPrueba();
    const referencia = new ElementoPrueba();
    const boton = new ElementoPrueba();
    formulario.elements = { monto, tipoPago: metodo, referenciaExterna: referencia };
    const etiquetaMonto = new ElementoPrueba();
    const etiquetaReferencia = new ElementoPrueba();
    const cambio = new ElementoPrueba();
    const valorCambio = new ElementoPrueba();
    cambio.querySelector = () => valorCambio;
    const controles = {
        button: boton,
        ".cobros__etiqueta-monto": etiquetaMonto,
        ".cobros__referencia": etiquetaReferencia,
        ".cobros__cambio": cambio,
    };
    formulario.querySelector = selector => controles[selector];
    let Vista;
    const globales = {
        HTMLElement: class {},
        Option: class { constructor(_texto, value) { this.value = value; } },
        document: { createElement: etiqueta => etiqueta === "form" ? formulario : new ElementoPrueba() },
        customElements: { define: (_, clase) => { Vista = clase; } },
    };
    for (const [nombre, valor] of Object.entries(globales)) {
        const anterior = Object.getOwnPropertyDescriptor(globalThis, nombre);
        Object.defineProperty(globalThis, nombre, { value: valor, configurable: true, writable: true });
        t.after(() => anterior
            ? Object.defineProperty(globalThis, nombre, anterior)
            : delete globalThis[nombre]);
    }
    await import(`../../src/boundary/cobros-view.js?${t.name}`);
    const vista = new Vista();
    const pagos = [];
    vista.servicio = { async solicitarJson(ruta, opciones) {
        assert.equal(ruta, `${conSesion ? "cobros" : "pagos"}/facturas/factura-prueba/abonos`);
        assert.equal(opciones.metodo, "POST");
        pagos.push(opciones.datos);
        return respuestas.shift();
    } };
    vista.filtro = "ordenes";
    vista.conSesion = conSesion;
    vista.mostrarLista = () => assert.fail("Un abono no debe cambiar de pestaña");
    vista.actualizar = async () => { vista.actualizaciones = (vista.actualizaciones ?? 0) + 1; };
    vista.ejecutar = async (_mensaje, operacion) => {
        try { await operacion(); } catch (error) { vista.error = error.message; }
    };
    const historial = new ElementoPrueba();
    const importes = new ElementoPrueba();
    const aviso = new ElementoPrueba();
    const acciones = new ElementoPrueba();
    const situacion = new ElementoPrueba();
    situacion.textContent = "PENDIENTE";
    vista.formularioPago("factura-prueba", inicial,
        { historial, importes, aviso, acciones, situacion });
    acciones.append(formulario);
    return {
        vista, formulario, monto, metodo, referencia, boton, aviso, acciones, historial, situacion,
        pagos, etiquetaMonto, cambio, valorCambio,
    };
}

const resumen = (abonado, saldo, completado) =>
    ({ idFactura: "factura-prueba", total: 10, abonado, saldo, completado });
const enviar = formulario => formulario.onsubmit({ preventDefault() {} });

test("dos abonos mantienen la factura y solo el segundo habilita la impresión", async t => {
    const c = await prepararCobro(t, [resumen(5, 5, false), resumen(10, 0, true)], true);
    assert.equal(c.monto.value, "");
    c.monto.value = "5";
    await enviar(c.formulario);
    assert.equal(c.acciones.children[0], c.formulario);
    assert.equal(c.situacion.textContent, "PENDIENTE");
    assert.equal(c.monto.max, "");
    assert.equal(c.monto.value, "");
    assert.match(c.valorCambio.textContent, /0\.00/);
    assert.match(c.aviso.textContent, /efectivo.*Quedan.*5\.00/);
    assert.equal(c.vista.actualizaciones, undefined);

    c.metodo.value = "TARJETA";
    c.metodo.onchange();
    assert.equal(c.monto.max, "5.00");
    assert.equal(c.cambio.hidden, true);
    c.referencia.value = "PRUEBA-001";
    c.monto.value = "5";
    await enviar(c.formulario);
    assert.deepEqual(c.pagos, [
        { monto: 5, tipoPago: "EFECTIVO" },
        { monto: 5, tipoPago: "TARJETA", referenciaExterna: "PRUEBA-001" },
    ]);
    assert.equal(c.historial.children.length, 2);
    assert.equal(c.situacion.textContent, "PAGADA");
    assert.equal(c.acciones.children[0].textContent, "Imprimir / guardar como PDF");
    assert.equal(c.vista.filtro, "ordenes");
});

test("si la respuesta cierra una factura con un abono parcial se requiere actualizar", async t => {
    const c = await prepararCobro(t, [resumen(10, 0, true)]);
    c.monto.value = "5";
    await enviar(c.formulario);
    assert.match(c.vista.error, /no coincide con el abono/);
    assert.equal(c.boton.disabled, true);
    assert.equal(c.acciones.children[0], c.formulario);
    assert.equal(c.situacion.textContent, "PENDIENTE");
    assert.equal(c.historial.children.length, 0);
});


test("Cobros factura la orden con la sesión y conserva la factura abierta", async t => {
    const { vista, formulario } = await prepararCobro(t, [], true);
    const llamadas = [];
    formulario.elements = { caja: new ElementoPrueba(), cliente: new ElementoPrueba() };
    vista.contenido = new ElementoPrueba();
    vista.marcarSeleccion = () => {};
    vista.encabezadoDetalle = () => new ElementoPrueba();
    vista.productos = () => new ElementoPrueba();
    vista.abrirFactura = async id => { vista.facturaMostrada = id; };
    vista.servicio = {
        async solicitarJson(ruta, opciones) {
            llamadas.push({ ruta, opciones });
            if (ruta === "cobros/ordenes/orden-prueba/productos-facturables") {
                return [{ idOrdenProducto: "fila-prueba", precio: 6.50, observaciones: "Cliente: Ana" }];
            }
            if (ruta === "cobros/cajas") {
                return [{ idCaja: "caja-activa", nombre: "Caja 1", activo: true }];
            }
            if (ruta === "cobros/ordenes/orden-prueba/facturas") return { idFactura: "factura-prueba" };
            assert.fail(`Ruta inesperada: ${ruta}`);
        },
    };

    await vista.abrirOrden("orden-prueba");
    assert.equal(vista.contenido.children.at(-1), formulario);
    await enviar(formulario);
    assert.equal(vista.error, undefined);
    assert.deepEqual(llamadas.at(-1), {
        ruta: "cobros/ordenes/orden-prueba/facturas",
        opciones: { metodo: "POST", datos: { idCaja: "caja-activa", cliente: "Ana" } },
    });
    assert.equal(vista.facturaMostrada, "factura-prueba");
    assert.equal(vista.actualizaciones, 1);
    assert.equal(vista.filtro, "ordenes");
});


test("recibir 20 dólares para un saldo de 15 muestra el cambio y registra 15", async t => {
    const inicial = { ...resumen(0, 15, false), total: 15 };
    const pagada = { ...inicial, abonado: 15, saldo: 0, completado: true };
    const c = await prepararCobro(t, [pagada], true, inicial);
    assert.equal(c.cambio.hidden, false);
    assert.equal(c.etiquetaMonto.textContent, "Efectivo recibido ($)");
    assert.equal(c.monto.max, "");
    c.monto.value = "20";
    c.monto.oninput();
    assert.match(c.valorCambio.textContent, /5\.00/);
    await enviar(c.formulario);
    assert.deepEqual(c.pagos, [{ monto: 15, tipoPago: "EFECTIVO" }]);
    assert.match(c.aviso.textContent, /Cambio a entregar:.*5\.00/);
    assert.equal(c.situacion.textContent, "PAGADA");
});

test("tarjeta oculta el cambio y conserva el límite del saldo", async t => {
    const c = await prepararCobro(t, [], true);
    c.monto.value = "15.02";
    c.monto.oninput();
    assert.match(c.valorCambio.textContent, /5\.02/);
    c.metodo.value = "TARJETA";
    c.metodo.onchange();
    assert.equal(c.cambio.hidden, true);
    assert.equal(c.referencia.required, true);
    assert.equal(c.monto.max, "10.00");
    c.referencia.value = "PRUEBA-002";
    await enviar(c.formulario);
    assert.deepEqual(c.pagos, []);
    assert.match(c.vista.error, /El monto no puede superar el saldo/);
    c.metodo.value = "EFECTIVO";
    c.metodo.onchange();
    assert.equal(c.cambio.hidden, false);
    assert.equal(c.referencia.required, false);
    assert.equal(c.monto.max, "");
    assert.match(c.valorCambio.textContent, /5\.02/);
});
