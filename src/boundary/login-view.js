export class LoginView extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<section aria-labelledby="login-titulo">
        <header class="contenido__cabecera"><p class="contenido__etiqueta">PERSONAL · CAFEFE</p>
        <h1 id="login-titulo">Acceso del personal</h1>
        <p class="contenido__descripcion">Ingresa para consultar las órdenes o acceder a Cobros según tu rol.</p></header>
        <div class="tarjeta acceso"><h2>Iniciar sesión</h2>
        <form><label>Nombre del empleado<input name="nombre" autocomplete="username" required maxlength="255"></label>
        <label>UUID del empleado<input name="uuid" type="password" autocomplete="off" required spellcheck="false" aria-describedby="login-ayuda"></label>
        <button class="cafefe-boton">Iniciar sesión</button><p class="mensaje" role="status" aria-live="polite"></p></form>
        <p id="login-ayuda" class="ayuda">Utiliza el UUID asignado como contraseña. Tu sesión se cerrará tras 30 minutos de inactividad.</p>
        </div></section>`;
        this.querySelector('form').addEventListener('submit', async event => {
            event.preventDefault();
            const form = event.currentTarget; const boton = form.querySelector('button');
            const estado = form.querySelector('[role=status]');
            const nombre = form.elements.nombre.value; let uuid = form.elements.uuid.value;
            estado.dataset.error = 'false';
            form.elements.uuid.value = ''; boton.disabled = true; estado.textContent = 'Validando acceso…';
            try {
                const ruta = await this.acceso.entrar(nombre, uuid);
                if (this.isConnected) this.dispatchEvent(new CustomEvent('acceso-iniciado', { bubbles: true, detail: ruta }));
            } catch (error) { estado.dataset.error = 'true'; estado.textContent = error.message; }
            finally { uuid = ''; boton.disabled = false; }
        });
    }
}
customElements.define('cafefe-login', LoginView);
