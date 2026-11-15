import DefaultError from "../entity/default_error.js";

export function validarCredenciales(nombre, uuid) {
    if (!nombre?.trim() || !uuid?.trim()) throw new DefaultError("Completa el nombre y el UUID.", { codigo: "VALIDACION" });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid.trim()))
        throw new DefaultError("Escribe un UUID válido.", { codigo: "VALIDACION" });
}
export function permite(sesion, ruta) {
    const roles = { recepcion: ["barista", "cocinero"], cobros: ["cajero"] };
    return Boolean(sesion && roles[ruta]?.some(rol => sesion.roles?.includes(rol)));
}
export class Acceso {
    constructor(autenticar = null, salir = null, recuperar = null) {
        this.autenticar = autenticar;
        this.salir = salir;
        this.recuperarServidor = recuperar;
        this.version = 0;
        this.sesion = null;
        this.destino = "recepcion";
    }
    solicitar(ruta) {
        if (!['recepcion', 'cobros'].includes(ruta)) return "pedido";
        if (!this.sesion) { this.destino = ruta; return "login"; }
        return permite(this.sesion, ruta) ? ruta : "prohibido";
    }
    async entrar(nombre, uuid) {
        const version = ++this.version;
        this.sesion = null;
        validarCredenciales(nombre, uuid);
        if (!this.autenticar) throw new DefaultError("El acceso está pendiente de habilitar la autenticación en el servidor.");
        let respuesta;
        try { respuesta = await this.autenticar(nombre.trim(), uuid.trim()); }
        catch (error) {
            if ([401, 403, 404].includes(error.estado)) throw new DefaultError("No se pudo iniciar sesión con esas credenciales.", { estado: error.estado });
            throw new DefaultError("No fue posible iniciar sesión. Comprueba la conexión e inténtalo de nuevo.");
        }
        if (version !== this.version) throw new DefaultError('El acceso fue cancelado.');
        this.establecer(respuesta, nombre);
        return permite(this.sesion, this.destino) ? this.destino :
            permite(this.sesion, "recepcion") ? "recepcion" : "cobros";
    }
    establecer(respuesta, nombre = '') {
        if (respuesta?.activo !== true || !Array.isArray(respuesta.roles) ||
            !respuesta.roles.some(rol => ["barista", "cocinero", "cajero"].includes(rol)))
            throw new DefaultError("El empleado no tiene acceso habilitado.");
        this.sesion = Object.freeze({ nombre: String(respuesta.nombre ?? nombre.trim()), roles: Object.freeze([...respuesta.roles]) });
    }
    async recuperar() {
        if (!this.recuperarServidor) return;
        const version = ++this.version;
        try {
            const respuesta = await this.recuperarServidor();
            if (version === this.version) this.establecer(respuesta);
        } catch (error) {
            if (version !== this.version) return;
            this.sesion = null;
            if (error.estado !== 401) throw error;
        }
    }
    async cerrar() {
        this.version++;
        this.sesion = null;
        this.destino = "recepcion";
        if (this.salir) await this.salir();
    }
}
