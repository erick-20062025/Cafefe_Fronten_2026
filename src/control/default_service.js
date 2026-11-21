import DefaultError from "../entity/default_error.js";

import { API_URL } from "../config/api.js";

export default class DefaultService {
    constructor({
        urlApi = API_URL,
        solicitar = (url, opciones) => globalThis.fetch(url, opciones),
    } = {}) {
        this.urlApi = urlApi.endsWith("/") ? urlApi : urlApi + "/";
        this.solicitar = solicitar;
    }

    /**
     * Devuelve el JSON de la API o null cuando responde 204.
     * Recibe rutas relativas como "cajas" u "ordenes/pendientes".
     */
    async solicitarJson(ruta, { metodo = "GET", datos } = {}) {
        if (metodo !== 'GET' && globalThis.navigator?.onLine === false)
            throw new DefaultError("Esta acción requiere conexión. No se ha enviado ningún cambio.", {codigo:"SIN_CONEXION"});
        const url = new URL(ruta, this.urlApi);
        const opciones = {
            method: metodo,
            headers: { Accept: "application/json" },
        };

        if (datos !== undefined) {
            opciones.headers["Content-Type"] = "application/json";
            opciones.body = JSON.stringify(datos);
        }

        let respuesta;
        try {
            respuesta = await this.solicitar(url.href, opciones);
        } catch {
            throw new DefaultError("No se pudo conectar con la API de Cafefe.", {
                codigo: "CONEXION",
            });
        }

        if (respuesta.status === 204) {
            return null;
        }

        let contenido;
        try {
            contenido = await respuesta.json();
        } catch {
            if (respuesta.ok) {
                throw new DefaultError("La API devolvió una respuesta que no se pudo leer como JSON.", {
                    estado: respuesta.status,
                    codigo: "RESPUESTA_INVALIDA",
                });
            }
        }

        if (!respuesta.ok) {
            throw new DefaultError(contenido?.mensaje ?? `La API respondió HTTP ${respuesta.status}.`, {
                estado: respuesta.status,
                codigo: contenido?.codigo ?? null,
                detalle: contenido?.detalle ?? null,
            });
        }

        return contenido;
    }
}
