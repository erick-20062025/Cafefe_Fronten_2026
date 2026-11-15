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
    focus() { this.enfocado = true; }
    get valueAsNumber() { return this.value === "" ? NaN : Number(this.value); }
}

async function prepararCobro(t, respuestas, filtro = "ordenes") {
    const formulario = new ElementoPrueba();
    const monto = new ElementoPrueba();
    const metodo = new ElementoPrueba();
    const referencia = new ElementoPrueba();
    const boton = new ElementoPrueba();
    formulario.elements = { monto, tipoPago: metodo, referenciaExterna: referencia };
    formulario.querySelector = selector => selector === "button" ? boton : new ElementoPrueba();
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
        assert.equal(ruta, "pagos/facturas/factura-prueba/abonos");
        assert.equal(opciones.metodo, "POST");
        pagos.push(opciones.datos);
        return respuestas.shift();
    } };
    vista.filtro = filtro;
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
    vista.formularioPago("factura-prueba", resumen(0, 10, false),
        { historial, importes, aviso, acciones, situacion });
    acciones.append(formulario);
    return { vista, formulario, monto, metodo, referencia, boton, aviso, acciones, historial, situacion, pagos };
}

const resumen = (abonado, saldo, completado) =>
    ({ idFactura: "factura-prueba", total: 10, abonado, saldo, completado });
const enviar = formulario => formulario.onsubmit({ preventDefault() {} });

test("dos abonos mantienen la factura y solo el segundo habilita la impresión", async t => {
    const c = await prepararCobro(t, [resumen(5, 5, false), resumen(10, 0, true)]);
    assert.equal(c.monto.value, "");
    c.monto.value = "5";
    await enviar(c.formulario);
    assert.equal(c.acciones.children[0], c.formulario);
    assert.equal(c.situacion.textContent, "PENDIENTE");
    assert.equal(c.monto.max, "5.00");
    assert.equal(c.monto.value, "");
    assert.match(c.aviso.textContent, /efectivo.*Quedan.*5\.00/);
    assert.equal(c.vista.actualizaciones, undefined);

    c.metodo.value = "TARJETA";
    c.metodo.onchange();
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
