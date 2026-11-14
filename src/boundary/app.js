import './login-view.js';
import './recepcion-view.js';
import { Acceso, permite } from '../control/acceso.js';
import { registrarPwa } from '../control/pwa.js';
// Erick puede registrar los elementos con estos nombres antes de la navegación.
export const integraciones = { pedido: 'cafefe-pedido', cobros: 'cafefe-cobros' };
export class CafefeApp extends HTMLElement {
    connectedCallback() {
        this.acceso = new Acceso(); // Adaptador de autenticación pendiente de aprobación.
        const plantilla = document.querySelector('#base-cafefe');
        this.append(plantilla.content.cloneNode(true));
        this.querySelector('.navegacion').innerHTML = `<a class="navegacion__item" href="#/pedido">Pedido público</a>
        <a class="navegacion__item" href="#/recepcion">Recepción</a><a class="navegacion__item" href="#/cobros">Cobros</a>
        <a class="navegacion__item" href="#/login">Acceso del personal</a><button class="salir" hidden>Cerrar sesión</button>`;
        this.querySelector('.barra-lateral__nota').textContent = 'Acceso del personal según roles del servidor.';
        this.querySelector('.pie span:last-child').textContent = 'Segundo entregable · PPI115';
        this.querySelector('.salir').onclick = async () => {
            const cierre = this.acceso.cerrar(); this.navegar('pedido');
            try { await cierre; } catch { this.querySelector('.conexion').textContent = 'No se pudo confirmar el cierre en el servidor. Reconecta para volver a intentarlo.'; }
        };
        this.addEventListener('acceso-iniciado', event => this.navegar(event.detail));
        this.ruta = () => this.render(); this.conexion = () => {
            this.querySelector('.conexion').textContent = navigator.onLine ? '' : 'Sin conexión: la interfaz está disponible; las consultas requieren conexión.';
        };
        window.addEventListener('hashchange', this.ruta);
        window.addEventListener('online', this.conexion); window.addEventListener('offline', this.conexion);
        this.conexion(); this.render(); registrarPwa(this.querySelector('.instalar'), this.querySelector('.pwa-estado'));
    }
    disconnectedCallback() {
        window.removeEventListener('hashchange', this.ruta);
        window.removeEventListener('online', this.conexion); window.removeEventListener('offline', this.conexion);
    }
    navegar(ruta) { if (location.hash === `#/${ruta}`) this.render(); else location.hash = `/${ruta}`; }
    render() {
        let ruta = location.hash.slice(2) || 'pedido';
        if (['recepcion', 'cobros'].includes(ruta)) ruta = this.acceso.solicitar(ruta);
        const main = this.querySelector('main'); main.replaceChildren();
        this.querySelector('.salir').hidden = !this.acceso.sesion;
        for (const link of this.querySelectorAll('.navegacion a')) {
            const destino = link.hash.slice(2);
            link.hidden = Boolean(this.acceso.sesion && ['recepcion', 'cobros'].includes(destino) && !permite(this.acceso.sesion, destino));
            link.classList.toggle('navegacion__item--activo', destino === ruta);
            if (destino === ruta) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
        }
        if (ruta === 'login') {
            const vista = document.createElement('cafefe-login'); vista.acceso = this.acceso; main.append(vista);
        } else if (ruta === 'recepcion') main.append(document.createElement('cafefe-recepcion'));
        else if (integraciones[ruta] && customElements.get(integraciones[ruta])) main.append(document.createElement(integraciones[ruta]));
        else {
            const titulo = document.createElement('h1'); const mensaje = document.createElement('p');
            titulo.textContent = ({pedido: 'Pedido público', cobros: 'Cobros', prohibido: 'Acceso no permitido'})[ruta] || 'Página no encontrada';
            mensaje.textContent = ruta === 'prohibido' ? 'Tu rol no permite acceder a esta pantalla.' :
                integraciones[ruta] ? 'Punto de integración reservado para la pantalla de Erick.' : 'Usa el menú para continuar.';
            main.append(titulo, mensaje);
        }
    }
}
customElements.define('cafefe-app', CafefeApp);
