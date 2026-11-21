import PedidoPublicoService from "../control/pedido-publico-service.js";
import {
    armarPedido, categoriasActivas, fotoDeCategoria, fotoDeProducto, MAX_CANTIDAD, MAX_NOMBRE,
    MAX_UNIDADES, precioEnCentavos, totalEstimado, totalUnidades,
} from "../entity/pedido-publico-model.js";

const estilos = new URL("../recursos/estilos/pedido_publico.css", import.meta.url);
const carpetaImagenes = new URL("../recursos/imagenes/", import.meta.url);
const formatoPrecio = new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" });
const plantilla = document.createElement("template");
plantilla.innerHTML = `
    <link rel="stylesheet" href="${estilos.href}">
    <p id="aviso-conexion" class="aviso-conexion" role="alert" hidden></p>
    <p id="notificacion-exito" class="notificacion-exito" role="status" aria-live="polite" hidden></p>
    <button id="reintentar-conexion" type="button" hidden>Reconectar catálogo</button>
    <div class="pedido">
        <div class="catalogo">
            <section id="vista-tipos" aria-labelledby="pedido-titulo">
                <p class="etiqueta">HECHO PARA TU MOMENTO</p><h1 id="pedido-titulo" tabindex="-1">¿Qué se te antoja hoy?</h1>
                <h2>Tipos de producto</h2>
                <p id="estado-categorias" role="status"></p>
                <button id="reintentar-categorias" type="button" hidden>Reintentar categorías</button>
                <div id="categorias" class="categorias"></div>
            </section>
            <section id="seccion-productos" aria-labelledby="titulo-productos" hidden>
                <button class="volver" id="volver-tipos" type="button">← Volver a tipos de producto</button>
                <h1 id="titulo-productos" tabindex="-1"></h1>
                <p id="estado-productos" role="status"></p>
                <button id="reintentar-productos" type="button" hidden>Reintentar productos</button>
                <div id="productos" class="productos"></div>
            </section>
        </div>
        <section class="resumen" aria-labelledby="titulo-resumen">
            <h2 id="titulo-resumen">Tu carrito</h2>
            <p id="unidades" role="status">Aún no agregas productos.</p>
            <ul id="carrito"></ul>
            <div id="cotizacion" aria-live="polite"></div><p id="total" class="total" hidden></p>
            <form id="envio">
                <label for="nombre">Tu nombre</label>
                <input id="nombre" type="text" autocomplete="name" maxlength="${MAX_NOMBRE}" required>
                <button class="principal" id="enviar" type="submit">Enviar pedido</button>
            </form>
            <p id="resultado" role="status"></p>
        </section>
    </div>
`;

function crearBoton(texto, accion) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = texto;
    boton.addEventListener("click", accion);
    return boton;
}

class PedidoPublico extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" }).append(plantilla.content.cloneNode(true));
        this.productos = null;
        this.carrito = new Map();
        this.solicitudProductos = 0;
        this.enviando = false;
        this.versionEnvio = 0;
        this.nombre = this.elemento("nombre");
        this.resultado = this.elemento("resultado");

        this.elemento("reintentar-categorias").addEventListener("click", () => this.cargarCategorias());
        this.elemento("reintentar-productos").addEventListener("click", () => this.cargarProductos());
        this.elemento("volver-tipos").addEventListener("click", () => this.volverATipos());
        this.elemento("envio").addEventListener("submit", evento => this.enviar(evento));
    }

    connectedCallback() {
        this.servicio ??= new PedidoPublicoService();
        this.mostrarCarrito();
        this.mostrarConexion();
        this.cargarCategorias();
        this.cambioRed = () => this.actualizarConexion();
        window.addEventListener('online',this.cambioRed);window.addEventListener('offline',this.cambioRed);
        this.elemento('reintentar-conexion').onclick = this.cambioRed;
        this.alVolver = () => {
            const respaldo = this.servicio.aviso() || (this.categoria && this.servicio.aviso(this.categoria.idTipoProducto));
            if (!document.hidden && navigator.onLine !== false && respaldo) this.actualizarConexion();
        };
        document.addEventListener('visibilitychange', this.alVolver);
    }
    disconnectedCallback() {
        this.versionEnvio++;
        this.versionCotizacion = (this.versionCotizacion || 0) + 1;
        this.ocultarExito();
        document.removeEventListener('visibilitychange', this.alVolver);
        window.removeEventListener('online', this.cambioRed);
        window.removeEventListener('offline', this.cambioRed);
        this.solicitudCategorias = (this.solicitudCategorias || 0) + 1;
        this.solicitudProductos++;
    }

    actualizarConexion() {
        this.mostrarConexion();
        this.servicio.invalidar();
        this.solicitudProductos++;
        this.mostrarCarrito();
        this.actualizarCotizacion();
        this.cargarCategorias();
        if (this.categoria && !this.elemento('seccion-productos').hidden) this.cargarProductos();
    }

    ocultarExito() {
        clearTimeout(this.temporizadorExito);
        this.temporizadorExito = null;
        const banner = this.elemento("notificacion-exito");
        banner.hidden = true;
        banner.textContent = "";
    }

    mostrarExito() {
        this.ocultarExito();
        const banner = this.elemento("notificacion-exito");
        banner.textContent = "¡Pedido enviado correctamente!";
        banner.hidden = false;
        this.temporizadorExito = setTimeout(() => this.ocultarExito(), 5000);
    }

    mostrarConexion() {
        const aviso = this.elemento("aviso-conexion");
        const sinConexion = navigator.onLine === false || Boolean(this.servicio.aviso() || (this.categoria && this.servicio.aviso(this.categoria.idTipoProducto)));
        aviso.hidden = !sinConexion;
        this.elemento("reintentar-conexion").hidden = !sinConexion;
        aviso.textContent = sinConexion ? "SIN CONEXIÓN CON EL CATÁLOGO. Los datos guardados pueden estar desactualizados. Reconecta para enviar tu pedido." : "";
    }

    elemento(id) {
        return this.shadowRoot.getElementById(id);
    }

    async cargarCategorias() {
        const version=this.solicitudCategorias=(this.solicitudCategorias||0)+1;
        const estado = this.elemento("estado-categorias");
        const reintentar = this.elemento("reintentar-categorias");
        reintentar.hidden = true;
        estado.textContent = "Cargando categorías…";
        try {
            const categorias=await this.servicio.listarCategorias();
            if(version!==this.solicitudCategorias)return;
            this.mostrarCategorias(categorias);
            estado.textContent=this.servicio.aviso() || estado.textContent;
            this.mostrarConexion();
        } catch (error) {
            if (version !== this.solicitudCategorias) return;
            const codigo = error.estado ? ` (HTTP ${error.estado})` : "";
            estado.textContent = `No se pudieron cargar las categorías${codigo}. ${error.detalle || error.message}`;
            reintentar.hidden = false;
        }
    }

    mostrarCategorias(categorias) {
        const disponibles = categoriasActivas(categorias);
        this.elemento("estado-categorias").textContent = disponibles.length
            ? "" : "No hay categorías activas.";
        this.elemento("categorias").replaceChildren(...disponibles.map(categoria => {
            const boton = crearBoton(categoria.nombre, () => this.abrirTipo(categoria, boton));
            boton.className = "categoria";
            const imagen = this.crearImagen(categoria.imagen, fotoDeCategoria(categoria.nombre));
            const nombre = document.createElement("span");
            nombre.textContent = categoria.nombre;
            boton.replaceChildren(imagen, nombre);
            return boton;
        }));
    }

    crearImagen(valor, archivo) {
        const imagen = document.createElement("img");
        const foto = this.servicio.urlImagen(valor);
        const fotoLocal = new URL(archivo, carpetaImagenes).href;
        imagen.src = foto || fotoLocal;
        imagen.alt = "";
        imagen.loading = "lazy";
        if (foto) {
            imagen.addEventListener("error", () => { imagen.src = fotoLocal; }, { once: true });
        }
        return imagen;
    }

    abrirTipo(categoria, tarjeta) {
        this.categoria = categoria;
        this.tarjetaSeleccionada = tarjeta;
        this.elemento("vista-tipos").hidden = true;
        this.elemento("seccion-productos").hidden = false;
        const titulo = this.elemento("titulo-productos");
        titulo.textContent = categoria.nombre;
        titulo.focus();
        return this.cargarProductos();
    }

    volverATipos() {
        this.solicitudProductos++;
        this.productos = null;
        this.elemento("seccion-productos").hidden = true;
        this.elemento("vista-tipos").hidden = false;
        const destino = this.tarjetaSeleccionada || this.elemento("pedido-titulo");
        destino.focus();
    }

    async cargarProductos() {
        const idCategoria = this.categoria.idTipoProducto;
        const solicitud = ++this.solicitudProductos;
        const estado = this.elemento("estado-productos");
        const reintentar = this.elemento("reintentar-productos");
        reintentar.hidden = true;
        this.productos = null;
        this.elemento("productos").replaceChildren();
        estado.textContent = "Cargando productos…";
        try {
            const productos = await this.servicio.listarProductos(idCategoria);
            if (solicitud !== this.solicitudProductos) return;

            this.productos = productos.filter(producto => producto.activo === true);
            estado.textContent = this.servicio.aviso(idCategoria) || (this.productos.length ? "" : "Esta categoría no tiene productos disponibles.");
            this.mostrarConexion();
            this.mostrarProductos();
        } catch (error) {
            if (solicitud !== this.solicitudProductos) return;

            estado.textContent = error.detalle || error.message;
            reintentar.hidden = false;
        }
    }

    mostrarProductos() {
        if (this.productos === null) return;
        this.elemento("productos").replaceChildren(...this.productos.map(producto => {
            const fila = document.createElement("article");
            fila.className = "producto";
            const nombreProducto = producto.nombre.trim();
            const foto = this.crearImagen(producto.imagen, fotoDeProducto(nombreProducto, this.categoria.nombre));
            const cuerpo = document.createElement("div");
            cuerpo.className = "producto-cuerpo";
            const nombre = document.createElement("h2");
            nombre.textContent = nombreProducto;
            const acciones = document.createElement("div");
            acciones.className = "producto-acciones";
            const precio = precioEnCentavos(producto.precioSugerido);
            const importe = document.createElement("span");
            importe.textContent = precio === null ? "Precio no disponible" : formatoPrecio.format(precio / 100);
            const agregar = crearBoton("+", () => this.agregar(producto));
            agregar.className = "producto-agregar";
            agregar.setAttribute("aria-label", "Agregar " + nombreProducto);
            agregar.disabled = this.enviando || precio === null;
            acciones.append(importe, agregar);
            const caracteristicas = document.createElement('p'); caracteristicas.className='caracteristicas';
            caracteristicas.textContent = producto.caracteristicas || producto.comentarios || '';
            cuerpo.append(nombre, caracteristicas, acciones);
            fila.append(foto, cuerpo);
            return fila;
        }));
    }

    agregar(producto) {
        if (this.enviando) return;
        const id = producto.idProducto;
        const cantidad = this.carrito.get(id)?.cantidad || 0;
        if (cantidad >= MAX_CANTIDAD || totalUnidades(this.carrito) >= MAX_UNIDADES) {
            this.resultado.textContent = "Alcanzaste el límite de unidades permitido.";
            return;
        }
        this.carrito.set(id, {
            nombre: producto.nombre.trim(),
            caracteristicas: producto.caracteristicas || "",
            cantidad: cantidad + 1,
            precioCentavos: precioEnCentavos(producto.precioSugerido),
        });
        this.resultado.textContent = "";
        this.mostrarCarrito();
        this.actualizarCotizacion();
    }

    mostrarCarrito() {
        const unidades = totalUnidades(this.carrito);
        this.elemento("unidades").textContent = unidades
            ? `${unidades} ${unidades === 1 ? "unidad" : "unidades"}` : "Aún no agregas productos.";
        this.elemento("enviar").disabled = this.enviando || navigator.onLine===false || unidades === 0;
        const total = this.elemento("total");
        const estimado = totalEstimado(this.carrito);
        total.hidden = unidades === 0 || estimado === null;
        total.textContent = total.hidden ? "" : "Total estimado " + formatoPrecio.format(estimado);

        const lista = this.elemento("carrito");
        lista.replaceChildren(...Array.from(this.carrito, ([id, fila]) => {
            const li = document.createElement("li");
            const nombre = document.createElement("span");
            nombre.textContent = fila.nombre + (fila.caracteristicas ? " · " + fila.caracteristicas : "");
            if (fila.precioCentavos !== null) {
                nombre.textContent += " · " + formatoPrecio.format(fila.precioCentavos / 100);
            }
            const controles = document.createElement("div");
            controles.className = "controles-cantidad";
            const cambiarCantidad = cambio => {
                fila.cantidad += cambio;
                const eliminada = fila.cantidad === 0;
                if (eliminada) this.carrito.delete(id);

                this.resultado.textContent = "";
                const indice = Array.from(lista.children).indexOf(li);
                this.mostrarCarrito();
                this.actualizarCotizacion();
                const destino = lista.children[indice] || lista.lastElementChild;
                const botones = destino?.querySelectorAll("button");
                const boton = cambio > 0 && !botones?.[1].disabled ? botones?.[1] : botones?.[0];
                if (boton) boton.focus();
                else this.nombre.focus();
            };
            const quitar = crearBoton("−", () => cambiarCantidad(-1));
            quitar.setAttribute("aria-label", "Quitar una unidad de " + fila.nombre);
            quitar.disabled = this.enviando;
            const cantidad = document.createElement("span");
            cantidad.textContent = String(fila.cantidad);
            const aumentar = crearBoton("+", () => cambiarCantidad(1));
            aumentar.setAttribute("aria-label", "Agregar una unidad de " + fila.nombre);
            aumentar.disabled = this.enviando || fila.cantidad >= MAX_CANTIDAD || unidades >= MAX_UNIDADES;
            controles.append(quitar, cantidad, aumentar);
            li.append(nombre, controles);
            return li;
        }));
    }

    async actualizarCotizacion() {
        const version = this.versionCotizacion = (this.versionCotizacion || 0) + 1;
        const salida = this.elemento('cotizacion');
        if (!this.carrito.size) { salida.textContent=''; return; }
        if(navigator.onLine===false){salida.textContent='Precios orientativos sin conexión. No se pueden enviar pedidos.';return;}
        if (!this.servicio?.cotizar || this.enviando) return;
        salida.textContent = 'Consultando importe actual…';
        try {
            const resumen = await this.servicio.cotizar(armarPedido('Vista previa', this.carrito));
            if (version !== this.versionCotizacion || !this.isConnected) return;
            salida.textContent = `Total ${formatoPrecio.format(resumen.total)}`;
            this.elemento('total').textContent = 'Importe definitivo confirmado al registrar la orden.';
        } catch { if (version === this.versionCotizacion) salida.textContent = 'No se pudo actualizar la cotización. El servidor confirmará el total al enviar.'; }
    }

    async enviar(evento) {
        evento.preventDefault();
        if (this.enviando) return;
        if (navigator.onLine===false){this.resultado.textContent='Necesitas conexión para enviar un pedido. Los precios guardados son orientativos.';return;}
        let pedido;
        try {
            pedido = armarPedido(this.nombre.value, this.carrito);
        } catch (error) {
            this.resultado.textContent = error.message;
            return;
        }

        this.ocultarExito();
        const version = ++this.versionEnvio;
        this.versionCotizacion = (this.versionCotizacion || 0) + 1;
        this.enviando = true;
        this.nombre.disabled = true;
        this.mostrarCarrito();
        this.mostrarProductos();
        this.resultado.textContent = "Enviando pedido…";
        try {
            const orden = await this.servicio.enviar(pedido);
            if (version !== this.versionEnvio) return;
            if (!orden || typeof orden.idOrden !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(orden.idOrden))
                throw new Error('No se pudo confirmar el pedido. Verifica su registro antes de volver a enviarlo.');
            this.carrito.clear();
            this.nombre.value = "";
            this.resultado.textContent = "";
            this.elemento('cotizacion').textContent = "";
            this.categoria = null;
            this.tarjetaSeleccionada = null;
            this.volverATipos();
            this.mostrarExito();
            this.servicio.invalidar();
            this.cargarCategorias();
            this.dispatchEvent(new CustomEvent("pedido-registrado", {bubbles:true, composed:true}));
        } catch (error) {
            if (version !== this.versionEnvio) return;
            this.resultado.textContent = error.detalle || error.message;
        } finally {
            if (version !== this.versionEnvio) return;
            this.enviando = false;
            this.nombre.disabled = false;
            this.mostrarConexion();
            this.mostrarProductos();
            this.mostrarCarrito();
        }
    }
}

customElements.define("cafefe-pedido", PedidoPublico);
