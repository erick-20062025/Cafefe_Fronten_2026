import { conectarMenu } from "../control/menu_movil.js";
import './login-view.js';
import './recepcion-view.js';
import './pedido-publico-view.js';
import './cobros-view.js';
import { SesionService } from '../control/sesion_service.js';
import { OrdenService } from '../control/recepcion.js';
import { Acceso, permite } from '../control/acceso.js';
import { resolverRuta } from '../control/navegacion.js';
import { registrarPwa } from '../control/pwa.js';
import { MonitorConexion } from '../control/monitor_conexion.js';
// Erick puede registrar los elementos con estos nombres antes de la navegación.
export const integraciones = { pedido: 'cafefe-pedido', cobros: 'cafefe-cobros' };
export class CafefeApp extends HTMLElement {
    connectedCallback() {
        this.sesionApi = new SesionService();
        this.acceso = new Acceso((nombre, uuid) => this.sesionApi.entrar(nombre, uuid),
            () => this.sesionApi.cerrar(), () => this.sesionApi.recuperar());
        this.restaurando = true;
        this.estadoServidor = null;
        this.versionReconexion = 0;
        const plantilla = document.querySelector('#base-cafefe');
        this.append(plantilla.content.cloneNode(true));
        this.querySelector('.navegacion').innerHTML = `<a class="navegacion__item" href="#/pedido">Órdenes</a>
        <a class="navegacion__item" href="#/recepcion">Recepción de órdenes</a><a class="navegacion__item" href="#/cobros">Cobros</a>
        <button class="sesion-control cafefe-boton" type="button">Iniciar sesión</button><p class="personal-identidad" aria-live="polite"></p>`;
        this.limpiarMenu=conectarMenu(this);
        this.querySelector('.barra-lateral__nota').textContent = 'Acceso del personal según roles del servidor.';
        this.querySelector('.pie span:last-child').textContent = 'Cafefe · PPI115';
        this.querySelector('.sesion-control').onclick = async () => {
            if (!this.acceso.sesion) { this.navegar('login'); return; }
            const cierre = this.acceso.cerrar(); this.navegar('pedido'); this.render();
            try { await cierre; } catch { this.querySelector('.conexion').textContent = 'No se pudo confirmar el cierre en el servidor. Reconecta para volver a intentarlo.'; }
        };
        this.addEventListener('sesion-vencida', () => { this.acceso.sesion = null; this.render(); });
        this.addEventListener('acceso-iniciado', event => this.navegar(event.detail));
        this.ruta = () => this.render();
        window.addEventListener('hashchange', this.ruta);
        this.monitorConexion = new MonitorConexion({ apiUrl: this.sesionApi.urlApi,
            cambiar: estado => this.cambiarEstadoServidor(estado) });
        this.monitorConexion.iniciar();
        this.acceso.recuperar().catch(() => {
            // El monitor comprueba la API; no confundir falta de sesión con falta de red.
        }).finally(() => { this.restaurando = false; if (this.isConnected) this.render(); });
        this.render(); registrarPwa(this.querySelector('.instalar'), this.querySelector('.pwa-estado'));
    }
    /** El servidor caído no equivale a sesión cerrada: bloquea las vistas
     * privadas mientras no podemos verificar la sesión. */
    cambiarEstadoServidor(estado) {
        const anterior = this.estadoServidor;
        this.estadoServidor = estado;
        const aviso = this.querySelector('.conexion');
        if (aviso) aviso.textContent = estado === 'sin-red'
            ? 'Sin conexión de red. Puedes consultar el catálogo guardado, pero no enviar pedidos ni pagos.'
            : estado === 'servidor'
            ? 'Servidor no disponible. Puedes consultar el catálogo guardado, pero no enviar pedidos ni pagos.' : '';
        if (estado === 'operativo' && ['sin-red', 'servidor'].includes(anterior)) {
            void this.revalidarSesionTrasCorte();
        } else if (estado !== 'operativo') {
            ++this.versionReconexion;
            if (this.esRutaPrivada()) this.render();
            else this.actualizarBarraSesion();
        }
    }
    esRutaPrivada() {
        return ['login', 'recepcion', 'cobros'].includes(location.hash.replace(/^#\//, ''));
    }
    actualizarBarraSesion() {
        const desconectado = ['sin-red', 'servidor'].includes(this.estadoServidor);
        const boton = this.querySelector('.sesion-control');
        boton.disabled = desconectado;
        boton.textContent = desconectado ? 'Servidor no disponible'
            : this.acceso.sesion ? 'Cerrar sesión' : 'Iniciar sesión';
        this.querySelector('.personal-identidad').textContent = desconectado
            ? 'Sesión y permisos pendientes de verificar.'
            : this.restaurando ? 'Comprobando sesión…'
            : this.acceso.sesion ? `${this.acceso.sesion.nombre} · ${this.acceso.sesion.roles.join(', ')}`
            : 'Pedidos abiertos al público';
    }
    async revalidarSesionTrasCorte() {
        const version = ++this.versionReconexion;
        this.restaurando = true;
        if (this.esRutaPrivada()) this.render();
        else this.actualizarBarraSesion();
        try {
            await this.acceso.recuperar();
        } catch {
            // Un error transitorio no concede acceso: la vista privada queda
            // bloqueada y el usuario puede volver a iniciar sesión.
        } finally {
            if (version !== this.versionReconexion || !this.isConnected
                    || this.estadoServidor !== 'operativo') return;
            this.restaurando = false;
            if (this.esRutaPrivada()) {
                if (!this.acceso.sesion && location.hash !== '#/login') this.navegar('login');
                else this.render();
            } else this.actualizarBarraSesion();
        }
    }
    disconnectedCallback() {
        this.limpiarMenu?.();
        window.removeEventListener('hashchange', this.ruta);
        this.monitorConexion?.detener();
        ++this.versionReconexion;
    }
    navegar(ruta) { if (location.hash === `#/${ruta}`) this.render(); else location.hash = `/${ruta}`; }
    render() {
        const ruta = resolverRuta(location.hash, this.acceso);
        const main = this.querySelector('main'); main.replaceChildren();
        this.actualizarBarraSesion();
        if (this.estadoServidor === 'servidor' || this.estadoServidor === 'sin-red') {
            if (this.esRutaPrivada()) {
                main.textContent = 'Servidor no disponible. Recepción, Cobros y el inicio de sesión requieren conexión. Espera a que se restablezca el servicio.';
                return;
            }
        }
        for (const link of this.querySelectorAll('.navegacion a')) {
            const destino = link.hash.slice(2);
            link.hidden = Boolean(this.acceso.sesion && ['recepcion', 'cobros'].includes(destino) && !permite(this.acceso.sesion, destino));
            link.classList.toggle('navegacion__item--activo', destino === ruta);
            if (destino === ruta) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
        }
        if (this.restaurando && ['login', 'recepcion', 'cobros'].includes(ruta)) {
            main.textContent = 'Comprobando sesión…'; return;
        }
        if (ruta === 'login') {
            const vista = document.createElement('cafefe-login'); vista.acceso = this.acceso; main.append(vista);
        } else if (ruta === 'recepcion') {
            const vista = document.createElement('cafefe-recepcion');
            vista.servicio = new OrdenService({urlApi:this.sesionApi.urlApi, solicitar:async (url, opciones) => {
                const respuesta = await fetch(url, {...opciones, credentials:'include', cache:'no-store'});
                if ([401,403].includes(respuesta.status)) this.dispatchEvent(new CustomEvent('sesion-vencida'));
                return respuesta;
            }});
            main.append(vista);
        } else if (ruta === 'cobros') {
            const vista = document.createElement(integraciones.cobros);
            vista.servicio = this.sesionApi;
            vista.conSesion = true;
            main.append(vista);
        } else if (integraciones[ruta] && customElements.get(integraciones[ruta])) {
            main.append(document.createElement(integraciones[ruta]));
        }
        else {
            const titulo = document.createElement('h1'); const mensaje = document.createElement('p');
            titulo.textContent = ({pedido: 'Pedido público', cobros: 'Cobros', prohibido: 'Acceso no permitido'})[ruta] || 'Página no encontrada';
            mensaje.textContent = ruta === 'prohibido' ? 'Tu rol no permite acceder a esta pantalla.' :
                integraciones[ruta] ? 'Punto de integración reservado para la pantalla de Erick.' : 'Usa el menú para continuar.';
            titulo.className = 'contenido__cabecera'; mensaje.className = 'contenido__descripcion';
            main.append(titulo, mensaje);
        }
    }
}
customElements.define('cafefe-app', CafefeApp);
