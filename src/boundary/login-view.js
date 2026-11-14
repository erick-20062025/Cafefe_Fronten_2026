export class LoginView extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<section class="tarjeta acceso"><h1>Acceso del personal</h1>
        <p>Ingresa tu nombre y el UUID asignado como contraseña.</p>
        <form><label>Nombre del empleado<input name="nombre" autocomplete="username" required maxlength="255"></label>
        <label>UUID del empleado<input name="uuid" type="password" autocomplete="off" required spellcheck="false"></label>
        <button>Iniciar sesión</button><p role="status" aria-live="polite"></p></form></section>`;
        this.querySelector('form').addEventListener('submit', async event => {
            event.preventDefault();
            const form = event.currentTarget; const boton = form.querySelector('button');
            const estado = form.querySelector('[role=status]');
            const nombre = form.elements.nombre.value; let uuid = form.elements.uuid.value;
            form.elements.uuid.value = ''; boton.disabled = true; estado.textContent = 'Validando acceso…';
            try {
                const ruta = await this.acceso.entrar(nombre, uuid);
                if (this.isConnected) this.dispatchEvent(new CustomEvent('acceso-iniciado', { bubbles: true, detail: ruta }));
            } catch (error) { estado.textContent = error.message; }
            finally { uuid = ''; boton.disabled = false; }
        });
    }
}
customElements.define('cafefe-login', LoginView);
