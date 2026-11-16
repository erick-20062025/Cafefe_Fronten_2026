import { SesionService } from "./sesion_service.js";

export default class PedidoPublicoService {
    constructor({ api = new SesionService() } = {}) {
        this.api = api;
    }

    async listarCategorias() {
        const categorias = await this.api.solicitarJson("tipos-producto");
        if (!Array.isArray(categorias)) {
            throw new Error("La API no devolvió una lista de categorías.");
        }
        return categorias;
    }

    async listarProductos(idCategoria) {
        const ruta = `producto-tipos-producto/tipos-producto/${encodeURIComponent(idCategoria)}`;
        const relaciones = await this.api.solicitarJson(ruta);
        if (!Array.isArray(relaciones)) {
            throw new Error("La API no devolvió las asociaciones del tipo de producto.");
        }

        const ids = new Set();
        for (const relacion of relaciones) {
            const referencia = relacion?.idProducto;
            const id = typeof referencia === "string" ? referencia : referencia?.idProducto;
            if (typeof id !== "string" || !id.trim()) {
                throw new Error("Una asociación del catálogo no contiene un identificador de producto válido.");
            }
            ids.add(id);
        }

        return Promise.all(Array.from(ids, id =>
            this.api.solicitarJson(`productos/${encodeURIComponent(id)}`)));
    }

    urlImagen(valor) {
        if (typeof valor !== "string" || !valor.trim()) return null;

        const ruta = valor.trim();
        if (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i.test(ruta)) {
            return ruta;
        }
        if (/^[a-z0-9+/]{32,}={0,2}$/i.test(ruta)) {
            const mime = ruta.startsWith("/9j/") ? "jpeg"
                : ruta.startsWith("iVBORw0KGgo") ? "png"
                : ruta.startsWith("UklGR") ? "webp" : null;
            if (mime) return `data:image/${mime};base64,${ruta}`;
        }

        try {
            const base = new URL(this.api.urlApi);
            const url = new URL(ruta, base);
            return url.origin === base.origin && /^https?:$/.test(url.protocol) ? url.href : null;
        } catch {
            return null;
        }
    }

    cotizar(pedido) { return this.api.solicitarJson("ordenes/cotizacion", {metodo:"POST",datos:pedido}); }

    enviar(pedido) {
        return this.api.solicitarJson("ordenes/publicas", { metodo: "POST", datos: pedido });
    }
}
