# Segundo entregable — estado del trabajo

> Para el estado actualizado de la revisión visual, 38 pruebas y verificación del shell sin servidor, consultar [REVISION-INTEGRACION.md](REVISION-INTEGRACION.md). Los resultados siguientes describen la primera implementación.

## Repositorios y alcance
Frontend real: `/home/diegoli/Documents/ppi 2026/Cafefe_Fronten_2026`.
Se ejecutó `git fetch origin`; la principal es `origin/main`, no existe `origin/master` en este repositorio.
La base `origin/feat/acceso-datos` ya está integrada por Erick en `origin/main` (c7dcd47).
Se creó `feature/frontend-diego-hu1-hu3-pwa` desde ese commit actualizado sin hacer merge ni push.
Backend: `/home/diegoli/Desktop/Cafefe_PPI_2026`, `master` igual a `origin/master` al inspeccionarlo.
Se conservó su cambio local en `nb-configuration.xml`; no se modificó ni se incluyó en commits.

## Estado funcional y límites
- HU1: formulario, validación de campos/UUID, errores genéricos, control de roles, destino solicitado y cierre local implementados y probados. **No hay autenticación funcional contra el servidor**: `Acceso` carece deliberadamente de adaptador hasta aprobar el contrato de seguridad. No simula sesiones. No guarda UUID en almacenamiento, caché o logs.
- HU3: servicio y Custom Element con pendientes, productos, selección, actualización, estados de carga/vacío/error y descarte de respuestas tardías. Usa `DefaultService.solicitarJson()` y `DefaultError` intactos. Su acceso desde SPA permanece bloqueado hasta habilitar HU1. Validado con respuestas controladas, no con datos reales.
- SPA: rutas hash `#/pedido`, `#/login`, `#/recepcion`, `#/cobros`; inicio público y restricciones por rol. La sesión del controlador solo vive en memoria y no constituye autorización de backend.
- PWA: manifiesto, PNG locales 192/512, registro relativo, instalación cuando el navegador emite `beforeinstallprompt`, caché versionada de una lista cerrada del shell. No intercepta API, querystrings, orígenes externos o métodos distintos a GET. No almacena órdenes. Al perder conexión se vacían órdenes y productos. Las nuevas versiones esperan que se cierren las pestañas anteriores.

## Archivos
- `src/boundary/`: `app.js`, `login-view.js`, `recepcion-view.js`.
- `src/control/`: `acceso.js`, `recepcion.js`, `pwa.js`; se reutiliza `default_service.js` sin cambios.
- `src/entity/default_error.js`: reutilizado sin cambios.
- `src/recursos/`: `estilos/personal.css`, `iconos/icon-192.png`, `iconos/icon-512.png`; `principal.css` de Erick intacto.
- Raíz: `index.html` adapta la base existente como plantilla, `manifest.webmanifest`, `sw.js`, este documento.
- Pruebas nuevas: `test/unit/control/acceso.test.mjs`, `test/unit/control/recepcion.test.mjs`, `test/unit/pwa.test.mjs`.

## Contrato real de órdenes
Base existente: `http://localhost:9080/Cafefe_PPI_2026-1.0-SNAPSHOT/api/`.
- `GET ordenes/pendientes`: array de resúmenes con `idOrden`, `fechaCreacion`, `idEmpleadoRol`; el DAO define pendiente por filas no pagadas, no por estado de preparación.
- `GET ordenes/{idOrden}/productos`: array con `idOrdenProducto`, `idProducto`, `producto`, `precio`, `observaciones`. No devuelve contenedor `productos` ni cantidad.
No se añadieron operaciones de preparación ni endpoints backend.

## Decisión pendiente de aprobación: autenticación
No existen login, sesión ni filtros de autorización en los recursos inspeccionados. `EmpleadoDAO.findById(UUID)` y `EmpleadoRolDAO.findByIdEmpleado(UUID)` permiten reutilizar las reglas y entidades.
Propuesta pendiente, NO implementada:
1. `POST api/sesion` con `{nombre, uuid}`. Comparar nombre con el empleado, exigir empleado activo y asignaciones/roles activos. Responder errores indistinguibles para credenciales incorrectas, inexistencia e inactividad; nunca registrar el cuerpo. Respuesta de éxito `{nombre, activo:true, roles:["barista", ...]}` sin UUID.
2. Sesión opaca del servidor, cookie HttpOnly, SameSite=Strict, renovación del identificador al entrar, expiración por inactividad (propuesta: 30 minutos); Secure obligatorio bajo HTTPS. Desarrollo HTTP únicamente en loopback y mismo hostname para UI/API. No persistir UUID como contraseña en el cliente.
3. `GET api/sesion` para confirmar/restaurar la sesión y `DELETE api/sesion` para invalidarla. Respuestas `Cache-Control: no-store`. Revalidar estado/roles en operaciones protegidas, invalidar UI ante 401/403.
4. Filtro de autorización de servidor: recepción para barista/cocinero y cobros para cajero; jamás aceptar roles enviados por cliente. Definir antes de habilitar autenticación la política de administración de empleados/roles: actualmente esos CRUD devuelven UUID que se usarían como contraseña. No es seguro habilitar login y mantenerlos públicos. Mantener únicamente endpoints de catálogo/pedido público expresamente revisados.
5. Validar Origin en mutaciones para protección CSRF, sin permitir orígenes comodín. CORS con credenciales solo para `http://127.0.0.1:5501` inicialmente; API con hostname `127.0.0.1` también. Puertos adicionales requieren aprobación explícita. OPTIONS debe permitir Content-Type y los métodos necesarios, con Vary: Origin. Añadir transporte con `credentials: include` al adaptador sin reescribir DefaultService.
La solicitud original exige aprobación antes de introducir un contrato nuevo de seguridad; por eso esta parte no se implementa todavía. Falta resolver permisos administrativos sin inventar un rol nuevo.

## Pruebas ejecutadas
31 pruebas Node pasan: 7 existentes de DefaultService, 12 de acceso con adaptador simulado, 8 de recepción y 4 de PWA. Las pruebas PWA ejecutan el worker en un contexto simulado: verifican precache, alcance en subcarpeta, exclusiones, navegación offline y limpieza de versiones.
En navegador integrado, servido con Python en 127.0.0.1:5501: inicio público, enlace Recepción muestra login, UUID inválido muestra error y limpia el campo contraseña.
Intento de recarga tras detener el servidor: no exitoso, navegador mostró conexión rechazada y la herramienta bloqueó la página interna de error. **No se considera validado el offline real ni instalada la PWA.** Pendiente repetir en Chrome/Edge con Service Worker activo y bajo Live Server. No se realizó prueba visual móvil.
Open Liberty no respondió en localhost:9080; no se comprobaron GET reales, preflight ni PostgreSQL. No se alteraron registros. No se modificó CORS/Liberty.

## Ejecutar y verificar
1. Abrir la carpeta frontend indicada en VS Code. Abrir `index.html` mediante **Open with Live Server** (extensión existente; no se añadieron paquetes npm).
2. Anotar el origen real que aparece en el navegador. Si no es 127.0.0.1:5501, acordar ese origen para CORS; cambiar solo el puerto del frontend no habilita el backend.
3. Visitar `#/pedido`: punto de integración de HU2. Visitar `#/recepcion` o `#/cobros`: debe mostrar login sin sesión. El login válido informa que falta habilitar la autenticación.
4. En Chrome/Edge, Application → Manifest: verificar iconos y start URL; Service Workers: esperar estado activated y comprobar scope correspondiente a la carpeta servida. Recargar con conexión antes de probar offline.
5. Application → Cache Storage: debe existir `cafefe-shell-v1` con recursos estáticos, ninguna URL de API. Network → Offline y recargar: debe abrir shell y avisar de conexión. Registrar resultado pendiente, no darlo por aprobado automáticamente.
6. Volver online; instalar con botón si aparece o menú del navegador. Verificar lanzamiento independiente. Durante desarrollo, eliminar el worker/caché desde DevTools o incrementar versión de `sw.js` al cambiar el shell. Cerrar todas las pestañas para activar una nueva versión.
7. Una vez aprobado e implementado backend, levantar Liberty/PostgreSQL con datos controlados, verificar GET en Network y OPTIONS de POST JSON con el origen elegido. Repetir login por rol, logout, sesión expirada y rechazo de llamadas directas sin sesión.

Ejecutar todas las pruebas Node (Node moderno con módulos ES):
```bash
cd '/home/diegoli/Documents/ppi 2026/Cafefe_Fronten_2026'
node --test --test-isolation=none test/unit/control/*.mjs test/unit/*.mjs
```
En este entorno Node no está en PATH; se usó:
```bash
/home/diegoli/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-isolation=none test/unit/control/*.mjs test/unit/*.mjs
```
`test/integracion/cajas.test.js` es una prueba de navegador existente, no node:test; requiere backend y se mantiene sin cambios.

## Integración de Erick
No se implementan HU2/HU4. Registrar `cafefe-pedido` y `cafefe-cobros` en módulos propios e importarlos antes de arrancar `app.js`; la SPA los monta en sus rutas correspondientes. Añadir sus módulos/recursos estáticos a RECURSOS del worker e incrementar versión. Nunca añadir respuestas API. El cobro necesita además la autorización real del servidor pendiente. El catálogo público y la creación de pedido deben conservar las reglas existentes.
