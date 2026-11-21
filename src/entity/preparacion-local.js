/** Ayuda de trabajo de esta vista. Nunca se persiste ni se envía al API. */
export class PreparacionLocal {
    #estados = new Map();
    static estados = Object.freeze(['PENDIENTE', 'PREPARANDO', 'LISTA', 'DESPACHADA']);
    estado(id) { return this.#estados.get(id) ?? 'PENDIENTE'; }
    avanzar(id) {
        const indice = PreparacionLocal.estados.indexOf(this.estado(id));
        if (indice < 3) this.#estados.set(id, PreparacionLocal.estados[indice + 1]);
        return this.estado(id);
    }
    conservar(ids) {
        const vigentes = new Set(ids);
        for (const id of this.#estados.keys()) if (!vigentes.has(id)) this.#estados.delete(id);
    }
}
