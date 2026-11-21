/** Coordina consultas independientes y descarta resultados de una carga anterior. */
export class ListadosCobros {
    constructor(servicio, listas, conSesion, alCambiar) {
        this.servicio = servicio;
        this.listas = listas;
        this.conSesion = conSesion;
        this.alCambiar = alCambiar;
        this.estados = new Map();
        this.version = 0;
    }

    async actualizar() {
        const version = ++this.version;
        // Se inician juntas, pero cada respuesta publica su propio estado al llegar.
        const tareas = this.listas.map(lista => this.cargar(lista, version));
        for (const tarea of tareas) await tarea;
    }

    invalidar() { this.version++; }

    publicar(lista, estado, version) {
        if (version !== this.version) return;
        this.estados.set(lista.id, estado);
        this.alCambiar(lista, estado);
    }

    async cargar(lista, version) {
        this.publicar(lista, {cargando: true, registros: [], error: ''}, version);
        try {
            const ruta = this.conSesion
                ? (lista.id === 'ordenes' ? 'cobros/ordenes-pendientes' : `cobros/facturas/${lista.id}`)
                : lista.ruta;
            const registros = await this.servicio.solicitarJson(ruta);
            if (!Array.isArray(registros)) throw new Error('La API devolvió un listado inválido.');
            this.publicar(lista, {cargando: false, registros, error: ''}, version);
        } catch (error) {
            this.publicar(lista, {cargando: false, registros: [], error: error.detalle || error.message}, version);
        }
    }
}
