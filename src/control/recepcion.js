import DefaultService from "./default_service.js";
import DefaultError from "../entity/default_error.js";

export class OrdenService extends DefaultService {
    constructor(opciones = {}) {
        const solicitar = opciones.solicitar ?? ((url, opciones) => fetch(url, opciones));
        super({ ...opciones, solicitar: (url, opciones) => solicitar(url, { ...opciones, cache: "no-store" }) });
    }
    preparar(id, esperado, siguiente) { return this.solicitarJson(`ordenes/${encodeURIComponent(id)}/preparacion`, {metodo:"PUT",datos:{esperado,siguiente}}); }
    pendientes() { return this.solicitarJson("ordenes/pendientes"); }
    productos(id) { return this.solicitarJson(`ordenes/${encodeURIComponent(id)}/productos`); }
}
export class Recepcion {
    constructor(servicio = new OrdenService(), cambio = () => {}, conectado = () => globalThis.navigator?.onLine !== false) {
        this.servicio = servicio; this.cambio = cambio; this.conectado = conectado;
        this.ordenes = []; this.productos = []; this.seleccion = null;
        this.cargando = false; this.cargandoProductos = false; this.error = "";
        this.versionLista = 0; this.versionDetalle = 0;
    }
    comprobarConexion() {
        if (!this.conectado()) throw new DefaultError("Necesitas conexión para consultar órdenes actualizadas.");
    }
    mensaje(error) {
        return error instanceof DefaultError ? (error.estado ? `HTTP ${error.estado}: ` : "") + error.message : "No se pudo completar la consulta.";
    }
    invalidar() {
        this.versionLista++; this.versionDetalle++;
        this.ordenes = []; this.productos = []; this.seleccion = null;
        this.cargando = false; this.cargandoProductos = false;
    }
    desconectar() {
        this.invalidar(); this.error = "Sin conexión. Las órdenes requieren información actualizada del servidor."; this.cambio();
    }
    async actualizar() {
        this.invalidar(); const version = this.versionLista;
        this.error = ""; this.cargando = true; this.cambio();
        try {
            this.comprobarConexion();
            const lista = await this.servicio.pendientes();
            if (!Array.isArray(lista)) throw new DefaultError("La respuesta de órdenes no es válida.");
            if (version === this.versionLista) this.ordenes = lista;
        } catch (error) { if (version === this.versionLista) this.error = this.mensaje(error); }
        finally { if (version === this.versionLista) { this.cargando = false; this.cambio(); } }
    }
    async seleccionar(id) {
        if (!this.ordenes.some(orden => orden.idOrden === id)) return;
        const version = ++this.versionDetalle;
        this.seleccion = id; this.productos = []; this.error = ""; this.cargandoProductos = true; this.cambio();
        try {
            this.comprobarConexion();
            const lista = await this.servicio.productos(id);
            if (!Array.isArray(lista)) throw new DefaultError("La respuesta de productos no es válida.");
            if (version === this.versionDetalle) this.productos = lista;
        } catch (error) { if (version === this.versionDetalle) this.error = this.mensaje(error); }
        finally { if (version === this.versionDetalle) { this.cargandoProductos = false; this.cambio(); } }
    }
}
