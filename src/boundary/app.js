import './login-view.js';
import './recepcion-view.js';
import './pedido_publico.js';
import './cobros-view.js';
import { SesionService } from '../control/sesion_service.js';
import { OrdenService } from '../control/recepcion.js';
import { Acceso, permite } from '../control/acceso.js';
import { resolverRuta } from '../control/navegacion.js';
import { registrarPwa } from '../control/pwa.js';
// Erick puede registrar los elementos con estos nombres antes de la navegación.
export const integraciones = { pedido: 'cafefe-pedido', cobros: 'cafefe-cobros' };
export class CafefeApp extends HTMLElement {
    connectedCallback() {
        this.sesionApi = new SesionService();
        this.acceso = new Acceso((nombre, uuid) => this.sesionApi.entrar(nombre, uuid),
            () => this.sesionApi.cerrar(), () => this.sesionApi.recuperar());
        this.restaurando = true;
        const plantilla = document.querySelector('#base-cafefe');
        this.append(plantilla.content.cloneNode(true));
        this.querySelector('.navegacion').innerHTML = `<a class="navegacion__item" href="#/pedido">Pedido público</a>
        <a class="navegacion__item" href="#/recepcion">Recepción</a><a class="navegacion__item" href="#/cobros">Cobros</a>
        <a class="navegacion__item" href="#/login">Acceso del personal</a><button class="salir cafefe-boton" hidden>Cerrar sesión</button>`;
        this.querySelector('.barra-lateral__nota').textContent = 'Acceso del personal según roles del servidor.';
        this.querySelector('.pie span:last-child').textContent = 'Segundo entregable · PPI115';
        this.querySelector('.salir').onclick = async () => {
            const cierre = this.acceso.cerrar(); this.navegar('pedido'); this.render();
            try { await cierre; } catch { this.querySelector('.conexion').textContent = 'No se pudo confirmar el cierre en el servidor. Reconecta para volver a intentarlo.'; }
        };
        this.addEventListener('sesion-vencida', () => { this.acceso.sesion = null; this.render(); });
        this.addEventListener('acceso-iniciado', event => this.navegar(event.detail));
        this.ruta = () => this.render(); this.conexion = () => {
            this.querySelector('.conexion').textContent = navigator.onLine ? '' : 'Sin conexión: la interfaz está disponible; las consultas requieren conexión.';
        };
        window.addEventListener('hashchange', this.ruta);
        window.addEventListener('online', this.conexion); window.addEventListener('offline', this.conexion);
        this.acceso.recuperar().catch(() => {
            this.querySelector('.conexion').textContent = 'No se pudo recuperar la sesión. Comprueba la conexión.';
        }).finally(() => { this.restaurando = false; if (this.isConnected) this.render(); });
        this.conexion(); this.render(); registrarPwa(this.querySelector('.instalar'), this.querySelector('.pwa-estado'));
    }
    disconnectedCallback() {
        window.removeEventListener('hashchange', this.ruta);
        window.removeEventListener('online', this.conexion); window.removeEventListener('offline', this.conexion);
    }
    navegar(ruta) { if (location.hash === `#/${ruta}`) this.render(); else location.hash = `/${ruta}`; }
    render() {
        const ruta = resolverRuta(location.hash, this.acceso);
        const main = this.querySelector('main'); main.replaceChildren();
        this.querySelector('.salir').hidden = !this.acceso.sesion;
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
        }
        else if (integraciones[ruta] && customElements.get(integraciones[ruta])) main.append(document.createElement(integraciones[ruta]));
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
