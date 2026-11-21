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
    setAttribute(nombre, valor) { this[nombre] = valor; }
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
    vista.contenido = { querySelector: () => new ElementoPrueba() };
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
        { monto: 5, tipoPago: "EFECTIVO", efectivoRecibido: 5 },
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
    assert.deepEqual(c.pagos, [{ monto: 15, tipoPago: "EFECTIVO", efectivoRecibido: 20 }]);
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


test("formulario informa que el cambio no se guarda en el historial", async t => {
    const c = await prepararCobro(t, []);
    assert.match(c.formulario.innerHTML, /<h4>Registrar abono<\/h4>/);
    assert.match(c.formulario.innerHTML, /name="monto"[^>]*required/);
    assert.match(c.formulario.innerHTML, /name="tipoPago"/);
    assert.match(c.formulario.innerHTML, /aria-live="polite"/);
    assert.match(c.formulario.innerHTML, /no queda guardado en el historial/);
    assert.match(c.formulario.innerHTML, /type="submit"/);
});


test("monto inválido no envía un abono ni cambia la factura", async t => {
    const c = await prepararCobro(t, []);
    c.monto.value = "-1";
    await enviar(c.formulario);
    assert.match(c.vista.error, /monto válido/);
    assert.deepEqual(c.pagos, []);
    assert.equal(c.situacion.textContent, "PENDIENTE");
});

test("fallo de red no confirma un cobro ni anuncia cambio entregado", async t => {
    const c = await prepararCobro(t, []);
    c.vista.servicio.solicitarJson = async () => { throw new Error("Sin conexión"); };
    c.monto.value = "20";
    await enviar(c.formulario);
    assert.match(c.vista.error, /No se pudo confirmar el abono/);
    assert.match(c.vista.error, /revisá el historial antes de volver a pagar/);
    assert.equal(c.situacion.textContent, "PENDIENTE");
    assert.ok(!c.aviso.textContent);
});


test("ticket pagado renderiza importes oficiales y permite imprimir sin inventar descuentos", async t => {
    const c = await prepararCobro(t, [], true);
    c.vista.contenido = new ElementoPrueba();
    c.vista.marcarSeleccion = () => {};
    c.vista.servicio.solicitarJson = async ruta => {
        if (ruta.endsWith('/resumen')) return resumen(10, 0, true);
        if (ruta.endsWith('/abonos')) return [{monto: 4, tipoPago: 'EFECTIVO'}, {monto: 6, tipoPago: 'TARJETA'}];
        return {idFactura: 'factura-prueba', estado: 'PAGADA', cliente: 'Ana', productos: [
            {idProducto: 'cafe', producto: 'Café', precio: 5},
            {idProducto: 'cafe', producto: 'Café', precio: 5}]};
    };
    await c.vista.abrirFactura('factura-prueba');
    const texto = nodo => [nodo.textContent || '', ...nodo.children.map(texto)].join(' ');
    const resultado = texto(c.vista.contenido);
    assert.match(resultado, /Comprobante de consumo/);
    assert.match(resultado, /PAGADA/);
    assert.match(resultado, /Cliente: Ana/);
    assert.match(resultado, /Café/);
    assert.match(resultado, /10.00/);
    assert.match(resultado, /Imprimir/);
    assert.doesNotMatch(resultado, /Descuentos|Subtotal|Cambio entregado|Registrar abono/);
});

function prepararCierre(vista) {
    vista.estado = new ElementoPrueba(); vista.estado.textContent = 'Cobro anterior';
    vista.columnas = new ElementoPrueba(); vista.actualizarBoton = new ElementoPrueba();
    vista.contenido = new ElementoPrueba();
    vista.marcarSeleccion = id => { vista.seleccion=id; };
    vista.mostrarLista = id => { vista.filtro=id; };
}
test('cerrar ticket limpia selección y cambio; reabrir consulta sin duplicar pagos', async t => {
    const c=await prepararCobro(t,[],true); prepararCierre(c.vista);
    const solicitudes=[];
    c.vista.servicio.solicitarJson=async (ruta,opciones)=>{
        solicitudes.push({ruta,opciones});
        if(ruta.endsWith('/resumen'))return resumen(10,0,true);
        if(ruta.endsWith('/abonos'))return [{monto:10,tipoPago:'EFECTIVO'}];
        return {idFactura:'factura-prueba',estado:'PAGADA',productos:[]};
    };
    await c.vista.abrirFactura('factura-prueba');
    const texto=n=>[n.textContent||'',...n.children.map(texto)].join(' ');
    c.vista.contenido.append(Object.assign(new ElementoPrueba(),{textContent:'Cambio entregado $5.00'}));
    const acciones=c.vista.contenido.children[2];
    assert.equal(acciones.children[1].textContent,'Cerrar factura');
    acciones.children[1].onclick();
    assert.equal(c.vista.facturaAbierta,null); assert.equal(c.vista.seleccion,null);
    assert.equal(c.vista.estado.textContent,''); assert.equal(c.vista.estado.dataset.error,'false');
    assert.equal(c.vista.filtro,'ordenes');
    assert.doesNotMatch(texto(c.vista.contenido),/Cambio entregado|PAGADA/);
    await enviar(c.formulario); // Un formulario descartado tampoco puede registrar otro abono.
    await c.vista.abrirFactura('factura-prueba');
    assert.equal(c.vista.facturaAbierta,'factura-prueba');
    assert.match(texto(c.vista.contenido),/PAGADA/);
    assert.doesNotMatch(texto(c.vista.contenido),/Cambio entregado/);
    assert.equal(solicitudes.length,6); assert.ok(solicitudes.every(s=>!s.opciones?.metodo));
});
test('respuesta tardía no restaura una factura cerrada', async t => {
    const c=await prepararCobro(t,[],true);prepararCierre(c.vista);
    const pendientes=[];
    c.vista.servicio.solicitarJson=ruta=>new Promise(resolve=>pendientes.push(()=>resolve(
        ruta.endsWith('/resumen')?resumen(10,0,true):ruta.endsWith('/abonos')?[]:{idFactura:'factura-prueba',estado:'PAGADA',productos:[]})));
    const apertura=c.vista.abrirFactura('factura-prueba');
    c.vista.cerrarFactura();
    for(const responder of pendientes)responder();
    await apertura;
    assert.equal(c.vista.facturaAbierta,null);assert.equal(c.vista.seleccion,null);
    assert.match(c.vista.contenido.children[0].textContent,/Seleccioná/);
});

test('un error tardío después de cerrar no restaura mensajes ni bloqueo del cobro', async t => {
    const c=await prepararCobro(t,[],true);prepararCierre(c.vista);
    let rechazar;
    const ejecutar=Object.getPrototypeOf(c.vista).ejecutar;
    const pendiente=ejecutar.call(c.vista,'Consultando…',()=>new Promise((_,reject)=>{rechazar=reject;}));
    assert.equal(c.vista.columnas.inert,true);
    c.vista.cerrarFactura();
    rechazar(new Error('Respuesta del comprobante anterior'));
    await pendiente;
    assert.equal(c.vista.estado.textContent,'');
    assert.equal(c.vista.estado.dataset.error,'false');
    assert.equal(c.vista.columnas.inert,false);
    assert.equal(c.vista.actualizarBoton.disabled,false);
    assert.equal(c.vista.ocupado,false);
});
