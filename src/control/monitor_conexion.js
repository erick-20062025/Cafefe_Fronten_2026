import { API_URL } from '../config/api.js';

/** Comprobación de red real: 401 de sesión anónima = backend operativo. */
export class MonitorConexion {
    constructor({ apiUrl = API_URL, solicitar = (url, opciones) => fetch(url, opciones),
            conectado = () => globalThis.navigator?.onLine !== false,
            cambiar = () => {}, intervalo = 15000, tiempoEspera = 5000 } = {}) {
        this.url = new URL('sesion', apiUrl).href;
        this.solicitar = solicitar;
        this.conectado = conectado;
        this.cambiar = cambiar;
        this.intervalo = intervalo;
        this.tiempoEspera = tiempoEspera;
        this.estado = null;
        this.version = 0;
        this.activo = false;
    }
    publicar(estado) {
        if (this.estado === estado) return;
        this.estado = estado;
        this.cambiar(estado);
    }
    async comprobar() {
        if (!this.activo) return;
        const version = ++this.version;
        this.abortador?.abort();
        if (!this.conectado()) {
            this.publicar('sin-red');
            return;
        }
        const abortador = new AbortController();
        this.abortador = abortador;
        const espera = setTimeout(() => abortador.abort(), this.tiempoEspera);
        try {
            const respuesta = await this.solicitar(this.url, {
                method: 'GET', credentials: 'include', cache: 'no-store',
                headers: { Accept: 'application/json' }, signal: abortador.signal,
            });
            if (this.activo && version === this.version)
                this.publicar(respuesta.status === 200 || respuesta.status === 401 ? 'operativo' : 'servidor');
        } catch {
            if (this.activo && version === this.version)
                this.publicar(this.conectado() ? 'servidor' : 'sin-red');
        } finally {
            clearTimeout(espera);
            if (this.abortador === abortador) this.abortador = null;
        }
    }
    iniciar() {
        if (this.activo) return;
        this.activo = true;
        this.cambioRed = () => this.comprobar();
        this.alVolver = () => { if (!document.hidden) this.comprobar(); };
        window.addEventListener('online', this.cambioRed);
        window.addEventListener('offline', this.cambioRed);
        document.addEventListener('visibilitychange', this.alVolver);
        this.temporizador = setInterval(() => { if (!document.hidden) this.comprobar(); }, this.intervalo);
        this.comprobar();
    }
    detener() {
        this.activo = false;
        this.version++;
        this.abortador?.abort();
        clearInterval(this.temporizador);
        window.removeEventListener('online', this.cambioRed);
        window.removeEventListener('offline', this.cambioRed);
        document.removeEventListener('visibilitychange', this.alVolver);
    }
}
