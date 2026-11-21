import DefaultService from "./default_service.js";
export class RecepcionService extends DefaultService {
    constructor(opciones = {}) {
        const solicitar = opciones.solicitar ?? ((url, opciones) => fetch(url, opciones));
        super({ ...opciones, solicitar: (url, opciones) => solicitar(url, { ...opciones, cache: "no-store" }) });
    }
    pendientes() { return this.solicitarJson("ordenes/pendientes"); }
    productos(id) { return this.solicitarJson(`ordenes/${encodeURIComponent(id)}/productos`); }
}
