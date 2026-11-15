# Revisión de integración — 14 de noviembre de 2026

## Trabajo de Erick encontrado
Se ejecutaron status, branch -a y fetch origin antes de modificar archivos.
Solo existen origin/main (c7dcd47) y origin/feat/acceso-datos (4a0d9f1).
- f8eef98: estructura visual inicial, index.html y principal.css.
- 4a0d9f1: DefaultService, DefaultError y pruebas de acceso a datos.
- c7dcd47: integración de acceso a datos en main.
Ambas ramas ya son antecesoras de nuestra rama; no hay commits entrantes. No se hizo merge/cherry-pick vacío ni se copiaron carpetas. El usuario confirmó que quizá Erick aún no ha desarrollado Pedido/Cobros. No existen componentes publicados de esas pantallas.

`principal.css`, `default_service.js`, `default_error.js` y todas las pruebas originales de Erick permanecen idénticas a origin/main. Se mantienen los puntos de integración cafefe-pedido y cafefe-cobros. No se añadieron dependencias, frameworks o paquetes npm.

## Cambios realizados
- Login y Recepción reutilizan contenido__cabecera, contenido__etiqueta, contenido__descripcion, tarjeta, colores CSS, Arial, radio y espaciados de la base.
- personal.css extiende esos estilos con selectores limitados al personal; se eliminaron reglas globales button/input que podían alterar Pedido y Cobros. Los controles del shell usan la clase explícita cafefe-boton.
- Login: encabezado coherente con el shell, formulario en tarjeta, ayuda visible sobre autenticación pendiente, error legible y campos adaptables.
- Recepción: lista y detalle en dos columnas, una en móvil; identificador completo, fecha separada, selección resaltada, estados accesibles aria-busy. Datos del servidor siguen insertándose con textContent.
- navegacion.js permite probar el mismo resolvedor hash utilizado por la SPA. Rutas desconocidas no montan componentes. Se conserva el destino solicitado durante Login y se actualiza inmediatamente la interfaz al cerrar sesión.
- PWA: versión cafefe-shell-v2, incluye el nuevo módulo de navegación y limpia versiones anteriores; informa disponibilidad cuando el worker está listo. No se cambió la política de datos/API.
- test/manual/recepcion.html y recepcion.js: prueba visual aislada con datos ficticios, vacío y error; sin API ni sesión. No se incluye en precache.

## Pruebas reales
38/38 pruebas Node pasan, 0 fallos:
- 7 existentes de DefaultService.
- 12 de acceso con adaptador controlado (no autentican contra backend).
- 8 de recepción.
- 4 del resolvedor de navegación (público, rutas desconocidas, roles y cierre).
- 3 de registro PWA, soporte e instalación simulada.
- 4 de manifiesto/caché/recursos del worker.
`git diff --check` pasa. No hay cambios en archivos compartidos de Erick mencionados arriba.

Navegador integrado, servido con Python en http://127.0.0.1:5501:
- Login carga módulos ES; validación de UUID muestra error. Cobros sin sesión muestra Login.
- Capturas de Login y Recepción en escritorio y viewport móvil solicitado de 390×844; tarjetas/formulario se adaptan, navegación mantiene desplazamiento horizontal de la base.
- Página de prueba de Recepción: primera orden muestra Café de prueba ($2.50), segunda Pan de prueba ($1.25); lista vacía y HTTP 503 simulado muestran sus estados correctos.
- Consola consultada sin errores/advertencias durante la revisión inicial de Login.
- Nueva versión del worker activada al cerrar la pestaña anterior. La aplicación mostró disponibilidad del shell.
- Con el proceso del servidor estático detenido: recarga de index.html#/login y navegación a Pedido público exitosas. Esto comprueba apertura desde caché sin servidor; no equivale a una prueba de todos los eventos de desconexión del sistema operativo.

No comprobado:
- Instalación real como aplicación independiente: no se completó ni se presentó botón de instalación en el navegador integrado.
- Live Server: no se encontró instalado en las carpetas de extensiones inspeccionadas. No se instaló; se usó servidor estático estándar.
- Open Liberty: curl a localhost:9080 devolvió conexión fallida (HTTP 000). Sin pruebas GET reales, CORS o OPTIONS de autenticación. No se modificaron registros ni configuración Liberty.
- Login real y navegación autenticada: contrato pendiente; no se simula autenticación en la SPA. Roles y cierre se probaron con adaptador en pruebas Node.

## Ejecutar y comprobar
Desde una terminal:
```bash
cd '/home/diegoli/Documents/ppi 2026/Cafefe_Fronten_2026'
python3 -m http.server 5501 --bind 127.0.0.1
```
Abrir http://127.0.0.1:5501/index.html y http://127.0.0.1:5501/test/manual/recepcion.html. El servidor de esta revisión fue detenido después de probar caché. Python sirve módulos ES pero no ofrece recarga automática.

Con Live Server ya instalado: abrir esa carpeta en VS Code, clic derecho en index.html → Open with Live Server. Usar la URL/puerto que realmente muestre. Solo el origen aprobado debe añadirse a CORS; un puerto distinto no queda autorizado automáticamente.

Si aparecen estilos anteriores: cerrar todas las pestañas de ese origen y volver a abrir para activar v2. En desarrollo también se puede eliminar el registro y caché desde DevTools → Application. Para comprobar PWA: verificar Manifest, Service Workers (activated, scope de la carpeta), Cache Storage (solo shell); activar Offline en Network y recargar; volver online e instalar mediante el menú del navegador si lo permite. Verificar lanzamiento independiente manualmente.

Pruebas (Node moderno):
```bash
node --test --test-isolation=none test/unit/control/*.mjs test/unit/*.mjs
```
En esta máquina, Node no figura en PATH. Ejecutable usado:
```bash
/home/diegoli/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-isolation=none test/unit/control/*.mjs test/unit/*.mjs
```
La prueba original test/integracion/index.html consulta cajas desde navegador y requiere Liberty. No forma parte de node:test.

## Autenticación: propuesta concreta, todavía NO implementada
Base propuesta de desarrollo: http://127.0.0.1:9080/Cafefe_PPI_2026-1.0-SNAPSHOT/api/ (mismo hostname que frontend para cookies SameSite).

### Contrato
POST sesion, Content-Type: application/json:
```json
{"nombre":"Nombre de prueba","uuid":"00000000-0000-0000-0000-000000000001"}
```
UUID de ejemplo ficticio. No usar credenciales reales en documentación, URL o logs.
Respuesta 200:
```json
{"nombre":"Nombre de prueba","activo":true,"roles":["barista"]}
```
No devolver idEmpleado/UUID. Cookie opaca HttpOnly de sesión de servidor, sin token en almacenamiento JS. Cache-Control: no-store en todas las respuestas de sesión.

Validación: campos string no vacíos, nombre tras trim de 2–255 caracteres, UUID canónico. Buscar con EmpleadoDAO.findById; comparar nombre exacto tras trim (sin apellido, sin transformar mayúsculas); exigir Empleado.activo, EmpleadoRol.activo y Rol.activo. Obtener asignaciones mediante EmpleadoRolDAO.findByIdEmpleado, normalizar nombres de rol a minúscula para la respuesta y aceptar únicamente barista/cocinero/cajero. No confiar en roles del cliente.

JSON malformado/campos inválidos: 400. UUID/nombre incorrectos, empleado inexistente/inactivo: mismo 401 genérico; empleado autenticado sin rol permitido: 403 genérico. Formato de error compatible con ApiResponse, por ejemplo:
```json
{"codigo":"AUTH-401","mensaje":"No se pudo iniciar sesión con esas credenciales.","detalle":null}
```
GET sesion devuelve el mismo JSON público de la sesión vigente, o 401. DELETE sesion invalida la sesión y cookie, devuelve 204 (también sin sesión). Caducidad propuesta: 30 minutos inactiva. Renovar identificador al entrar. Revalidar empleado y roles al consultar operaciones restringidas. Cookie SameSite=Strict, HttpOnly, Path limitado al contexto; Secure en HTTPS, excepción HTTP únicamente para desarrollo loopback. No persistir UUID usado como contraseña en cliente.

### Permisos del servidor
- GET ordenes/pendientes y GET ordenes/{id}/productos: barista/cocinero; cajero solo si el flujo real de HU4 requiere esos mismos recursos, no asumirlo antes de integrar HU4.
- Endpoints Pago/Factura para cobro: cajero, con reglas DAO existentes. Revisar todas las rutas concretas del flujo al integrar HU4.
- Empleados, empleado-roles y roles no deben permanecer públicos: exponen UUID o permiten modificar asignaciones. Propuesta mínima sin inventar rol administrador: denegar por defecto su acceso REST para los tres roles de esta entrega hasta acordar la política administrativa. Esto cambia el acceso administrativo actual y requiere aprobación explícita.
- Catálogo y creación de pedido público: permitir exclusivamente rutas revisadas del flujo de HU2. Denegar por defecto otras operaciones sensibles. No basta ocultar enlaces.

### CORS y CSRF
Único origen propuesto inicialmente: http://127.0.0.1:5501. UI y API deben usar 127.0.0.1, no mezclar localhost. Adaptador basado en DefaultService con fetch credentials: include y cache: no-store.
Responder al origen permitido con Access-Control-Allow-Origin exacto, Access-Control-Allow-Credentials: true y Vary: Origin. Preflight sin exigir cookie; Content-Type permitido; métodos GET/POST/DELETE para sesión y los necesarios por ruta existente. Rechazar mutaciones de sesión desde Origin ausente/no aprobado para el flujo de navegador; no habilitar comodín. No registrar cuerpos de login. Revisar cobertura CSRF de las demás mutaciones protegidas antes de habilitarlas.

Una vez aprobado/implementado y con Liberty activo, verificar el preflight sin enviar credenciales:
```bash
curl -i -X OPTIONS 'http://127.0.0.1:9080/Cafefe_PPI_2026-1.0-SNAPSHOT/api/sesion' \
  -H 'Origin: http://127.0.0.1:5501' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```
En Network del navegador verificar POST/OPTIONS y cookies con datos de prueba, después GET de sesión, autorización por rol, expiración y DELETE. Curl no sustituye la comprobación CORS del navegador.

Pendiente de aprobación: este contrato completo, origen y restricción de administración. No se modificó la seguridad del backend en esta revisión.
