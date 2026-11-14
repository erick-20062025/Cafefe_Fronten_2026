import DefaultError from "../entity/default_error.js";

const URL_API = "http://localhost:9080/Cafefe_PPI_2026-1.0-SNAPSHOT/api/";

export default class DefaultService {
    constructor({
        urlApi = URL_API,
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
