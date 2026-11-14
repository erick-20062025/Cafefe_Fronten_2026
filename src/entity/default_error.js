export default class DefaultError extends Error {
    constructor(mensaje, { estado = null, codigo = null, detalle = null } = {}) {
        super(mensaje);
        this.name = "DefaultError";
        this.estado = estado;
        this.codigo = codigo;
        this.detalle = detalle;
    }
}
