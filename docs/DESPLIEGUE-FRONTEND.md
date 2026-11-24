# Frontend del tercer parcial

`src` es ahora el Document Root autónomo: contiene index.html, manifiesto, service worker, módulos, CSS e imágenes. El index de la raíz redirige conservando query y hash a src/index.html para continuar usando Live Server. El worker anterior retira únicamente su shell antiguo; no borra el catálogo ni datos del usuario. La nueva PWA usa su propio alcance y shell v28. Una instalación vieja necesita conexión para recibir esta transición.

```sh
docker build -f Dockerfile.frontend -t cafefe-frontend:ppi115-tercer-parcial .
docker network inspect ppi115net >/dev/null 2>&1 || docker network create ppi115net
docker run -d --name cafefe.frontend -h cafefe.frontend --network ppi115net \
  -p 127.0.0.1:80:80 \
  --mount "type=bind,src=$PWD/src,dst=/var/www/html,readonly" \
  cafefe-frontend:ppi115-tercer-parcial
```

La imagen parte de debian:stable, instala Nginx de Debian y exige el montaje. No incluye una copia escondida de src que pudiera ocultar errores de montaje. El proceso maestro abre el puerto 80 y sus workers ejecutan como www-data. Document Root de solo lectura. Los contextos Docker usan listas permitidas en .dockerignore: no se envían Git, credenciales ni carpetas locales.

## API y sesión

En desarrollo `src/config/api.js` conserva el backend habitual 127.0.0.1:9080 y su contexto anterior. En Nginx, **la misma URL `/config/api.js`** devuelve configuración para `/cafefe/api/` en el origen del navegador, con Cache-Control no-store. No se escribe en el directorio montado. El service worker consulta configuración por red primero, con alternativa offline; no guarda respuestas de API ni credenciales.

Nginx resuelve cafefe.backend usando DNS de Docker y reenvía `/cafefe/api/` a `http://cafefe.backend:9080/cafefe/api/`. Conserva método, cuerpo, Origin y cookies. No reescribe Origin para hacer pasar una petición externa por autorizada. Mantener la ruta /cafefe evita cambiar el Path de la cookie HttpOnly/Lax. El backend debe recibir CAFEFE_FRONTEND_ORIGIN igual al origen real: por defecto http://localhost; con puerto 18080, http://localhost:18080. El nombre interno cafefe.backend nunca necesita resolverse en el navegador.

DNS se vuelve a resolver tras recrear el backend. No se reintentan automáticamente mutaciones contra otro upstream. API sin caché. Los estáticos inexistentes devuelven 404; la entrada admite recarga de la SPA. El router existente usa hash. No se incorporan frameworks, dependencias Node ni compilación frontend a la imagen.

PWA disponible en localhost o HTTPS. Una IP remota por HTTP puede mostrar la SPA, pero no ofrece contexto seguro para instalar el service worker. Para otro servidor web, configurar la URL central y el proxy correspondiente; no editar cada servicio.

## Verificación de esta fase

npm test con Node >=22: 105 casos. Las dos pruebas nuevas verifican importaciones/recursos de src y limpieza limitada del worker anterior. Se construyó la imagen y se ejecutó nginx -t. En contenedor aislado sin red: index y módulo principal 200, JS inexistente 404, configuración API relativa correcta, worker con cabeceras de actualización. Estos controles no certifican login, flujo de pagos ni PWA en navegador real bajo Docker: se harán en la siguiente fase.

La matriz y el administrador del entorno desechable están en el backend: docs/PRUEBAS-TERCER-PARCIAL.md y scripts/pruebas-docker.py. No publicar aún.
