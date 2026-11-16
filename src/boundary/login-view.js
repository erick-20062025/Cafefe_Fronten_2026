export class LoginView extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<section class="login-panel" aria-labelledby="login-titulo">
        <header class="contenido__cabecera"><img class="login-logo" src="./src/recursos/imagenes/marca/200LogoCafefe.png" alt="Cafefe" width="120" height="120">
        <p class="contenido__etiqueta">BIENVENIDO AL EQUIPO</p><h1 id="login-titulo">Tu espacio en Cafefe</h1>
        <p class="contenido__descripcion">Accede a las herramientas de tu turno.</p></header>
        <div class="tarjeta acceso"><h2>Iniciar sesión</h2><form>
        <label for="personal-nombre">Nombre del empleado</label>
        <input id="personal-nombre" name="nombre" autocomplete="username" required maxlength="255" aria-describedby="nombre-ayuda">
        <p class="ayuda" id="nombre-ayuda">Escribe tu nombre tal como está registrado, respetando mayúsculas.</p>
        <label for="personal-uuid">UUID del empleado</label><div class="clave-control">
        <input id="personal-uuid" name="uuid" type="password" autocomplete="off" required spellcheck="false" aria-describedby="uuid-ayuda">
        <button class="mostrar-clave" type="button" aria-pressed="false" aria-controls="personal-uuid">Mostrar</button></div>
        <p class="ayuda" id="uuid-ayuda">Usa el identificador asignado como contraseña. No se guardará en este dispositivo.</p>
        <button type="submit" class="cafefe-boton">Iniciar sesión</button><p class="mensaje" role="status" aria-live="polite"></p>
        </form><p class="ayuda">La sesión caduca tras 30 minutos de inactividad.</p></div></section>`;
        const form = this.querySelector('form');
        const mostrar = this.querySelector('.mostrar-clave');
        mostrar.onclick = () => {
            const visible = form.elements.uuid.type === 'password';
            form.elements.uuid.type = visible ? 'text' : 'password';
            mostrar.textContent = visible ? 'Ocultar' : 'Mostrar'; mostrar.setAttribute('aria-pressed', String(visible));
        };
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (this.ocupado) return;
            this.ocupado = true;
            const boton = form.querySelector('[type=submit]'); const estado = form.querySelector('[role=status]');
            const nombre = form.elements.nombre.value; let uuid = form.elements.uuid.value;
            form.elements.uuid.value = ''; boton.disabled = true; mostrar.disabled = true; form.setAttribute('aria-busy','true');
            estado.dataset.error = 'false'; estado.textContent = 'Verificando tus datos…'; boton.textContent = 'Iniciando sesión…';
            try {
                const ruta = await this.acceso.entrar(nombre, uuid);
                if (this.isConnected) this.dispatchEvent(new CustomEvent('acceso-iniciado', { bubbles: true, detail: ruta }));
            } catch (error) { estado.dataset.error = 'true'; estado.textContent = error.message; }
            finally { uuid=''; this.ocupado=false; boton.disabled=false; mostrar.disabled=false; form.setAttribute('aria-busy','false'); boton.textContent='Iniciar sesión'; }
        });
    }
}
customElements.define('cafefe-login', LoginView);
