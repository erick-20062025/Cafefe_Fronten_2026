import { Recepcion } from "../control/recepcion.js";
export class RecepcionView extends HTMLElement {
    connectedCallback() {
        this.modelo = new Recepcion(this.servicio, () => this.render());
        this.offline = () => this.modelo.desconectar();
        window.addEventListener('offline', this.offline);
        this.innerHTML = `<section><header class="contenido__cabecera"><p class="contenido__etiqueta">PERSONAL · CAFEFE</p><h1>Recepción de órdenes</h1><p class="contenido__descripcion">Consulta las órdenes pendientes y selecciona una para ver sus productos.</p></header>
        <button class="actualizar">Actualizar listado</button><p class="mensaje" role="status" aria-live="polite"></p>
        <div class="recepcion-columnas"><section class="tarjeta"><h2>Órdenes pendientes</h2><div class="ordenes"></div></section>
        <section class="tarjeta"><h2 class="seleccion">Productos</h2><div class="productos"></div></section></div></section>`;
        this.querySelector('.actualizar').onclick = () => this.modelo.actualizar();
        this.modelo.actualizar();
    }
    disconnectedCallback() { window.removeEventListener('offline', this.offline); this.modelo?.invalidar(); }
    render() {
        if (!this.isConnected) return;
        const m = this.modelo;
        this.querySelector('[role=status]').textContent = m.error || (m.cargando ? 'Cargando órdenes…' : m.cargandoProductos ? 'Cargando productos…' : '');
        this.querySelector('[role=status]').dataset.error = String(Boolean(m.error));
        this.querySelector('.ordenes').setAttribute('aria-busy', String(m.cargando));
        this.querySelector('.productos').setAttribute('aria-busy', String(m.cargandoProductos));
        this.querySelector('.actualizar').disabled = m.cargando;
        const lista = this.querySelector('.ordenes'); lista.replaceChildren();
        if (!m.cargando && !m.error && !m.ordenes.length) lista.textContent = 'No hay órdenes pendientes.';
        for (const orden of m.ordenes) {
            const boton = document.createElement('button');
            boton.className = 'orden'; boton.setAttribute('aria-pressed', String(m.seleccion === orden.idOrden));
            const titulo = document.createElement('strong'); titulo.textContent = `Orden ${orden.idOrden}`;
            const fecha = document.createElement('time');
            const fechaValida = orden.fechaCreacion && !Number.isNaN(Date.parse(orden.fechaCreacion));
            fecha.textContent = fechaValida ? new Date(orden.fechaCreacion).toLocaleString('es-SV') : 'Sin fecha';
            if (fechaValida) fecha.dateTime = orden.fechaCreacion;
            boton.append(titulo, fecha);
            boton.onclick = () => m.seleccionar(orden.idOrden); lista.append(boton);
        }
        this.querySelector('.seleccion').textContent = m.seleccion ? `Orden seleccionada: ${m.seleccion}` : 'Productos';
        const productos = this.querySelector('.productos'); productos.replaceChildren();
        if (!m.seleccion) productos.textContent = 'Selecciona una orden para consultar sus productos.';
        else if (!m.cargandoProductos && !m.error && !m.productos.length) productos.textContent = 'Esta orden no tiene productos.';
        for (const producto of m.productos) {
            const item = document.createElement('article'); item.className = 'producto';
            const titulo = document.createElement('h3'); titulo.textContent = producto.producto || 'Producto sin nombre';
            const precio = document.createElement('p'); precio.textContent = producto.precio == null ? 'Precio no disponible' : new Intl.NumberFormat('es-SV', {style: 'currency', currency: 'USD'}).format(producto.precio);
            const nota = document.createElement('p'); nota.textContent = producto.observaciones || 'Sin observaciones';
            item.append(titulo, precio, nota); productos.append(item);
        }
    }
}
customElements.define('cafefe-recepcion', RecepcionView);
