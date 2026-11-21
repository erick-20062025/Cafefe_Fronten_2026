import { ListadosCobros } from "../control/listados-cobros.js";
import { agruparProductos } from '../entity/detalle_orden.js';
import DefaultService from "../control/default_service.js";
import { precioEnCentavos } from "../entity/pedido-publico-model.js";

const moneda = new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" });
const dinero = monto => moneda.format(monto);
const fecha = valor => valor ? new Date(valor).toLocaleString("es-SV", { timeZone: "America/El_Salvador" }) : "";
const listas = [
    { id: "ordenes", titulo: "Órdenes pendientes", ruta: "ordenes/pendientes", campo: "idOrden", vacio: "No hay órdenes pendientes." },
    { id: "pendientes", titulo: "Facturas pendientes", ruta: "pagos/facturas/pendientes", campo: "idFactura", vacio: "No hay facturas pendientes." },
    { id: "pagadas", titulo: "Facturas pagadas", ruta: "pagos/facturas/pagadas", campo: "idFactura", vacio: "No hay facturas pagadas." },
];
const etiquetasPago = { EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia", QR: "QR" };

function verificarAbono(anterior, respuesta, monto, id) {
    const total = precioEnCentavos(anterior.total);
    const abonado = precioEnCentavos(anterior.abonado);
    const importe = precioEnCentavos(monto);
    const siguiente = precioEnCentavos(respuesta?.abonado);
    const saldo = precioEnCentavos(respuesta?.saldo);
    return respuesta?.idFactura === id && total !== null && abonado !== null && importe > 0
        && siguiente === abonado + importe && siguiente <= total && saldo === total - siguiente
        && precioEnCentavos(respuesta.total) === total && respuesta.completado === (saldo === 0);
}

function nodo(etiqueta, texto) {
    const elemento = document.createElement(etiqueta);
    elemento.textContent = texto;
    return elemento;
}

class CobrosView extends HTMLElement {
    versionDetalle = 0;
    versionOperacion = 0;
    disconnectedCallback() { this.versionDetalle++; this.versionOperacion++; this.listados?.invalidar(); }
    connectedCallback() {
        this.servicio ??= new DefaultService();
        this.filtro = "ordenes";
        this.seleccion = null;
        this.facturaAbierta = null;
        this.innerHTML = `
            <section class="cobros">
                <header class="cobros__cabecera">
                    <div><h1>Cobros</h1><p>Facturá órdenes, registrá abonos y consultá comprobantes.</p></div>
                    <button type="button" class="cobros__actualizar">Actualizar</button>
                </header>
                <p class="cobros__estado" role="status" aria-live="polite"></p>
                <div class="cobros__columnas">
                    <aside class="tarjeta cobros__listas">
                        <nav class="cobros__filtros" aria-label="Listados de Cobros">
                            ${listas.filter(({ id }) => id !== "pendientes").map(({ id, titulo }) => `
                                <button type="button" data-filtro="${id}" aria-pressed="false">
                                    ${titulo}<span aria-hidden="true">—</span>
                                </button>`).join("")}
                        </nav>
                        <section data-panel="ordenes">
                            <h2 class="cobros__titulo-lista">Órdenes pendientes</h2>
                            <div class="cobros__lista" data-lista="ordenes"></div>
                            <h2 class="cobros__titulo-lista">Facturas por cobrar</h2>
                            <div class="cobros__lista" data-lista="pendientes"></div>
                        </section>
                        <section data-panel="pagadas" hidden>
                            <h2 class="cobros__titulo-lista">Facturas pagadas</h2>
                            <div class="cobros__lista" data-lista="pagadas"></div>
                        </section>
                    </aside>
                    <section class="tarjeta cobros__detalle" aria-label="Detalle del cobro">
                        <div class="cobros__contenido"><p class="cobros__vacio">Seleccioná una orden o factura para ver el detalle.</p></div>
                    </section>
                </div>
            </section>`;
        this.estado = this.querySelector(".cobros__estado");
        this.contenido = this.querySelector(".cobros__contenido");
        this.columnas = this.querySelector(".cobros__columnas");
        this.actualizarBoton = this.querySelector(".cobros__actualizar");
        this.actualizarBoton.onclick = () => this.ejecutar("Actualizando…", async () => {
            if (this.facturaAbierta) await this.abrirFactura(this.facturaAbierta);
            await this.actualizar();
        });
        for (const boton of this.querySelectorAll("[data-filtro]")) {
            boton.onclick = () => this.mostrarLista(boton.dataset.filtro);
        }
        this.mostrarLista(this.filtro);
        this.ejecutar("Cargando cobros…", () => this.actualizar());
    }

    mostrarLista(id) {
        this.filtro = id;
        for (const boton of this.querySelectorAll("[data-filtro]")) {
            boton.setAttribute("aria-pressed", String(boton.dataset.filtro === id));
        }
        for (const panel of this.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== id;
    }

    async ejecutar(mensaje, operacion) {
        if (this.ocupado) return;
        const version = ++this.versionOperacion;
        this.ocupado = true;
        this.estado.dataset.error = "false";
        this.estado.textContent = mensaje;
        this.columnas.inert = true;
        this.actualizarBoton.disabled = true;
        try {
            await operacion();
            if (version !== this.versionOperacion) return;
            this.estado.textContent = "";
        } catch (error) {
            if (version !== this.versionOperacion) return;
            this.estado.dataset.error = "true";
            this.estado.textContent = error.detalle || error.message;
        } finally {
            if (version !== this.versionOperacion) return;
            this.ocupado = false;
            this.columnas.inert = false;
            this.actualizarBoton.disabled = false;
        }
    }

    async actualizar() {
        if (!this.listados) {
            this.listados = new ListadosCobros(this.servicio, listas, this.conSesion,
                (lista, estado) => this.renderListado(lista, estado));
        }
        await this.listados.actualizar();
    }

    renderListado(lista, {cargando, registros, error}) {
        const destino = this.querySelector(`[data-lista="${lista.id}"]`);
        const contador = this.querySelector(`[data-filtro="${lista.id}"] span`);
        if (!destino) return;
        if (contador) contador.textContent = cargando ? '…' : error ? '—' : registros.length;
        destino.replaceChildren();
        if (cargando) destino.append(this.vacio('Cargando…'));
        else if (error) destino.append(this.vacio(error));
        else if (!registros.length) destino.append(this.vacio(lista.vacio));
        else for (const registro of registros) destino.append(this.filaLista(lista, registro));
    }

    filaLista(lista, registro) {
        const id = registro[lista.campo];
        const orden = lista.campo === "idOrden";
        const boton = nodo("button", "");
        boton.type = "button";
        boton.className = "cobros__fila";
        boton.dataset.registro = id;
        boton.title = id;
        boton.setAttribute("aria-pressed", String(this.seleccion === id));
        boton.append(nodo("strong", `${orden ? "Orden" : "Factura"} ${id.slice(0, 8)}`),
            nodo("span", orden ? fecha(registro.fechaCreacion) : registro.estado));
        boton.onclick = () => this.ejecutar(orden ? "Cargando orden…" : "Cargando factura…",
            () => orden ? this.abrirOrden(id) : this.abrirFactura(id));
        return boton;
    }

    marcarSeleccion(id) {
        this.seleccion = id;
        for (const fila of this.querySelectorAll("[data-registro]")) {
            fila.setAttribute("aria-pressed", String(fila.dataset.registro === id));
        }
    }

    vacio(texto) {
        const parrafo = nodo("p", texto);
        parrafo.className = "cobros__vacio";
        return parrafo;
    }

    async abrirOrden(id) {
        const version = ++this.versionDetalle;
        const ordenes = this.conSesion ? "cobros/ordenes" : "ordenes";
        const [filas, cajas] = await Promise.all([
            this.servicio.solicitarJson(`${ordenes}/${id}/productos-facturables`),
            this.servicio.solicitarJson(this.conSesion ? "cobros/cajas" : "cajas"),
        ]);
        if (version !== this.versionDetalle) return;
        const activas = cajas.filter(caja => caja.activo === true);
        this.facturaAbierta = null;
        this.marcarSeleccion(id);
        this.contenido.replaceChildren(this.encabezadoDetalle("Orden", id, "Por facturar"));
        if (!filas.length) {
            this.contenido.append(this.vacio("La orden ya está facturada. Buscala en Facturas por cobrar."));
            return;
        }
        this.contenido.append(this.productos(filas), this.importes([
            ['Total', filas.reduce((s, p) => s + Number(p.precio), 0)]
        ]));
        if (!activas.length) {
            this.contenido.append(nodo("p", "No hay cajas activas."));
            return;
        }
        if (!this.conSesion && !this.idEmpleadoRol) {
            this.contenido.append(this.vacio("Seleccioná un cajero para crear la factura."));
            return;
        }
        const precios = filas.map(fila => precioEnCentavos(fila.precio));
        const centavos = precios.reduce((suma, precio) => suma + precio, 0);
        if (precios.includes(null) || !Number.isSafeInteger(centavos)) {
            throw new Error("La orden contiene un precio inválido.");
        }
        const total = centavos / 100;
        const form = document.createElement("form");
        form.innerHTML = `<label>Caja <select name="caja" required></select></label>
            <label>Cliente <input name="cliente" maxlength="155"></label>
            <button class="cafefe-boton">Crear factura</button>`;
        form.elements.cliente.value = filas.map(fila => /^Cliente: ([^|]+)/.exec(fila.observaciones || "")?.[1]?.trim()).find(Boolean) || "";
        for (const caja of activas) form.elements.caja.add(new Option(caja.nombre, caja.idCaja));
        form.onsubmit = evento => {
            evento.preventDefault();
            if (version !== this.versionDetalle) return;
            return this.ejecutar("Creando factura…", async () => {
                const cliente = form.elements.cliente.value.trim();
                const datos = { idCaja: form.elements.caja.value, ...(cliente ? { cliente } : {}) };
                const ruta = this.conSesion ? `cobros/ordenes/${id}/facturas` : "facturas";
                if (!this.conSesion) {
                    datos.idEmpleadoRol = this.idEmpleadoRol;
                    datos.productos = filas.map(({ idOrdenProducto, precio }) => ({ idOrdenProducto, precio }));
                }
                const factura = await this.servicio.solicitarJson(ruta, { metodo: "POST", datos });
                if (version !== this.versionDetalle) return;
                this.facturaAbierta = factura.idFactura;
                this.contenido.replaceChildren(nodo("p", `Factura creada: ${factura.idFactura}`));
                await this.abrirFactura(factura.idFactura);
                await this.actualizar();
            });
        };
        this.contenido.append(this.importes([["Total de la orden", total]]), form);
    }

    async abrirFactura(id) {
        const version = ++this.versionDetalle;
        const ruta = this.rutaPago(id);
        const [factura, resumen, abonos] = await Promise.all([
            this.servicio.solicitarJson(this.conSesion ? ruta : `facturas/${id}`),
            this.servicio.solicitarJson(`${ruta}/resumen`),
            this.servicio.solicitarJson(`${ruta}/abonos`),
        ]);
        if (version !== this.versionDetalle) return;
        this.facturaAbierta = id;
        this.marcarSeleccion(id);
        const pagada = factura.estado === "PAGADA" && resumen.completado === true
            && precioEnCentavos(resumen.saldo) === 0;
        const pendiente = factura.estado === "PENDIENTE" && resumen.completado === false
            && precioEnCentavos(resumen.saldo) > 0;
        const ticket = nodo("article", "");
        ticket.className = "cobros__ticket";
        const logo=document.createElement('img'); logo.src='./src/recursos/imagenes/marca/200LogoCafefe.png'; logo.alt='Cafefe'; logo.width=90; logo.height=90;
        ticket.append(logo, nodo('h2','Cafefe'), nodo('p','Comprobante de consumo'));
        const ordenes=[...new Set((factura.productos || []).map(p=>p.idOrden).filter(Boolean))];
        for (const orden of ordenes) {
            const detalle=factura.productos.find(p=>p.idOrden===orden);
            if (detalle.atendidoPor) ticket.append(nodo('p', `Atendido por: ${detalle.atendidoPor}`));
            ticket.append(nodo('p',`Orden: ${orden}`),nodo('p',`Fecha de orden: ${fecha(detalle.fechaOrden) || 'No registrada'}`));
        }
        ticket.append(
            this.encabezadoDetalle("Factura", factura.idFactura, pagada ? "PAGADA" : pendiente ? "PENDIENTE" : "REVISAR SALDO"),
            nodo("p", "Fecha de emisión: " + fecha(factura.fechaFacturacion)),
            nodo("p", factura.cliente ? `Cliente: ${factura.cliente}` : "Consumidor final"),
            this.productos(factura.productos),

        );
        const historial = this.listaImportes(abonos.map(abono => [
            etiquetasPago[abono.tipoPago] || abono.tipoPago, abono.monto,
        ]));
        if (!abonos.length) {
            const vacio = nodo("li", "Todavía no hay abonos.");
            vacio.className = "cobros__sin-abonos";
            historial.append(vacio);
        }

        const importes = this.resumenFactura(resumen);
        ticket.append(nodo("h4","Abonos"),historial, importes);

        const aviso = nodo("p", "");
        aviso.className = "cobros__confirmacion";
        aviso.setAttribute("role", "status");
        const acciones = nodo("div", "");
        this.contenido.replaceChildren(ticket, aviso, acciones);

        if (pagada) {
            acciones.append(this.botonImprimir(), this.botonCerrarFactura());
        } else if (pendiente) {
            const situacion = ticket.querySelector(".cobros__situacion");
            acciones.append(this.conSesion || this.idEmpleadoRol
                ? this.formularioPago(id, resumen, { historial, importes, aviso, acciones, situacion })
                : this.vacio("Seleccioná un cajero para registrar el abono."));
        } else {
            acciones.append(this.vacio("El saldo y el estado de la factura no coinciden. Actualizá para verificar."));
        }
    }

    cerrarFactura() {
        this.versionDetalle++;
        this.versionOperacion++;
        this.facturaAbierta = null;
        this.marcarSeleccion(null);
        this.estado.textContent = "";
        this.estado.dataset.error = "false";
        this.ocupado = false;
        this.columnas.inert = false;
        this.actualizarBoton.disabled = false;
        this.contenido.replaceChildren(this.vacio("Seleccioná una orden o factura para comenzar."));
        this.mostrarLista("ordenes");
    }

    botonCerrarFactura() {
        const cerrar = nodo("button", "Cerrar factura");
        cerrar.type = "button";
        cerrar.className = "cafefe-boton cobros__cerrar";
        cerrar.onclick = () => this.cerrarFactura();
        return cerrar;
    }

    rutaPago(id) {
        return `${this.conSesion ? "cobros" : "pagos"}/facturas/${id}`;
    }

    resumenFactura(resumen) {
        return this.importes([
            ["Total", resumen.total], ["Abonado", resumen.abonado], ["Saldo", resumen.saldo],
        ]);
    }

    botonImprimir() {
        const imprimir = nodo("button", "Imprimir / guardar como PDF");
        imprimir.type = "button";
        imprimir.className = "cafefe-boton";
        imprimir.onclick = () => {
            document.body.classList.add("imprimiendo-cobro");
            try { window.print(); }
            finally { document.body.classList.remove("imprimiendo-cobro"); }
        };
        return imprimir;
    }

    formularioPago(id, resumenInicial, { historial, importes, aviso, acciones, situacion }) {
        const version = this.versionDetalle;
        const form = document.createElement("form");
        form.className = "cobros__pago";
        form.innerHTML = `<h4>Registrar abono</h4>
            <div class="cobros__campos-pago">
                <label>Forma de pago <select name="tipoPago"></select></label>
                <label><span class="cobros__etiqueta-monto">Efectivo recibido ($)</span>
                    <input name="monto" type="number" step="0.01" min="0.01" required>
                </label>
                <label class="cobros__referencia" hidden>Referencia <input name="referenciaExterna" maxlength="120"></label>
            </div>
            <p class="cobros__cambio" aria-live="polite">Cambio a entregar <strong>$0.00</strong></p>
            <p>El cambio se muestra al cobrar; no queda guardado en el historial.</p>
            <button type="submit" class="cafefe-boton">Registrar abono</button>`;
        const { monto: campoMonto, tipoPago: campoMetodo, referenciaExterna: campoReferencia } = form.elements;
        const enviar = form.querySelector("button");
        const etiquetaMonto = form.querySelector(".cobros__etiqueta-monto");
        const referencia = form.querySelector(".cobros__referencia");
        const cambio = form.querySelector(".cobros__cambio");
        const valorCambio = cambio.querySelector("strong");
        let confirmado = resumenInicial;

        function mostrarCambio() {
            const recibido = precioEnCentavos(campoMonto.valueAsNumber) ?? 0;
            const saldo = precioEnCentavos(confirmado.saldo);
            valorCambio.textContent = dinero(Math.max(0, recibido - saldo) / 100);
        }

        function configurarMetodo() {
            const efectivo = campoMetodo.value === "EFECTIVO";
            etiquetaMonto.textContent = efectivo ? "Efectivo recibido ($)" : "Monto del abono ($)";
            referencia.hidden = efectivo;
            campoReferencia.required = !efectivo;
            cambio.hidden = !efectivo;
            if (efectivo) campoMonto.removeAttribute("max");
            else campoMonto.max = confirmado.saldo.toFixed(2);
            mostrarCambio();
        }

        for (const [valor, etiqueta] of Object.entries(etiquetasPago)) {
            campoMetodo.add(new Option(etiqueta, valor));
        }
        campoMetodo.onchange = configurarMetodo;
        campoMonto.oninput = mostrarCambio;
        configurarMetodo();
        form.onsubmit = async evento => {
            evento.preventDefault();
            if (enviar.disabled || version !== this.versionDetalle) return;
            let siguienteControl;
            await this.ejecutar("Registrando abono…", async () => {
                const tipoPago = campoMetodo.value;
                const efectivo = tipoPago === "EFECTIVO";
                const referenciaExterna = campoReferencia.value.trim();
                const recibido = precioEnCentavos(campoMonto.valueAsNumber);
                const saldo = precioEnCentavos(confirmado.saldo);
                if (!recibido) throw new Error("Ingresá un monto válido.");
                if (!efectivo && recibido > saldo) throw new Error("El monto no puede superar el saldo.");
                if (!efectivo && !referenciaExterna) throw new Error("Ingresá la referencia del pago.");
                const aplicado = Math.min(recibido, saldo);
                const monto = aplicado / 100;
                const cambioCentavos = recibido - aplicado;
                const datos = { monto, tipoPago, ...(efectivo ? { efectivoRecibido: recibido / 100 } : { referenciaExterna }) };
                let resumen;
                try {
                    resumen = await this.servicio.solicitarJson(`${this.rutaPago(id)}/abonos`, { metodo: "POST", datos });
                } catch (error) {
                    if (!error.estado || error.estado >= 500 || error.codigo === "RESPUESTA_INVALIDA") {
                        enviar.disabled = true;
                        throw new Error("No se pudo confirmar el abono. Pulsá Actualizar y revisá el historial antes de volver a pagar.");
                    }
                    throw error;
                }
                if (version !== this.versionDetalle) return;
                if (!verificarAbono(confirmado, resumen, monto, id)) {
                    enviar.disabled = true;
                    throw new Error("El saldo devuelto no coincide con el abono. Pulsá Actualizar y revisá el historial antes de volver a pagar.");
                }

                confirmado = resumen;
                if (efectivo && cambioCentavos > 0) {
                    this.contenido.querySelector('.cobros__ticket').append(this.importes([["Cambio entregado",cambioCentavos/100]]));
                }
                historial.querySelector(".cobros__sin-abonos")?.remove();
                historial.append(this.renglonImporte(etiquetasPago[tipoPago], monto));
                importes.replaceChildren(...this.resumenFactura(resumen).children);
                const metodo = efectivo ? "en efectivo" : `con ${etiquetasPago[tipoPago]}`;
                const cambioConfirmado = cambioCentavos > 0
                    ? ` Cambio a entregar: ${dinero(cambioCentavos / 100)}.` : "";
                const registrado = `Registraste ${dinero(monto)} ${metodo}.${cambioConfirmado}`;
                if (resumen.completado && resumen.saldo === 0) {
                    aviso.textContent = `${registrado} Factura pagada.`;
                    situacion.textContent = "PAGADA";
                    situacion.dataset.pagada = "true";
                    siguienteControl = this.botonImprimir();
                    acciones.replaceChildren(siguienteControl, this.botonCerrarFactura());
                    campoMonto.value = "";
                    campoReferencia.value = "";
                    await this.actualizar();
                } else {
                    aviso.textContent = `${registrado} Quedan ${dinero(resumen.saldo)} por pagar.`;
                    campoMonto.value = "";
                    campoReferencia.value = "";
                    configurarMetodo();
                    siguienteControl = campoMonto;
                }
            });
            if (siguienteControl?.isConnected) siguienteControl.focus({ preventScroll: true });
        };
        return form;
    }

    encabezadoDetalle(tipo, id, estado) {
        const encabezado = nodo("header", "");
        encabezado.className = "cobros__identidad";
        const referencia = nodo("p", id);
        referencia.className = "cobros__id";
        const situacion = nodo("span", estado);
        situacion.className = "cobros__situacion";
        situacion.dataset.pagada = String(estado === "PAGADA");
        encabezado.append(nodo("h3", tipo), situacion, referencia);
        return encabezado;
    }

    productos(filas) {
        const tabla=document.createElement('table');tabla.className='cobros__productos';
        const cabeza=document.createElement('thead'), encabezado=document.createElement('tr');
        for(const texto of ['Cant.','Producto','Unitario','Importe'])encabezado.append(nodo('th',texto));
        cabeza.append(encabezado);tabla.append(cabeza);
        const cuerpo=document.createElement('tbody');
        for(const fila of agruparProductos(filas)){
            const renglon=document.createElement('tr');
            renglon.append(nodo('td',String(fila.cantidad)),nodo('td',`${fila.producto}${fila.caracteristicas ? ' · '+fila.caracteristicas : ''}`),nodo('td',dinero(fila.precio)),nodo('td',dinero(Number(fila.precio)*fila.cantidad)));cuerpo.append(renglon);
        }
        tabla.append(cuerpo);return tabla;
    }

    listaImportes(filas) {
        const lista = nodo("ul", "");
        lista.className = "cobros__renglones";
        for (const [concepto, monto] of filas) {
            lista.append(this.renglonImporte(concepto, monto));
        }
        return lista;
    }

    renglonImporte(concepto, monto) {
        const item = nodo("li", "");
        item.append(nodo("span", concepto), nodo("strong", dinero(monto)));
        return item;
    }

    importes(filas) {
        const lista = nodo("dl", "");
        lista.className = "cobros__importes";
        for (const [concepto, monto] of filas) {
            const item = nodo("div", "");
            item.append(nodo("dt", concepto), nodo("dd", dinero(monto)));
            lista.append(item);
        }
        return lista;
    }
}

customElements.define("cafefe-cobros", CobrosView);
