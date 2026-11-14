import assert from "node:assert/strict";
import { test } from "node:test";
import DefaultService from "../../../src/control/default_service.js";
import DefaultError from "../../../src/entity/default_error.js";

test("GET conserva el contexto de la API y devuelve una lista vacía", async () => {
    const servicio = new DefaultService({
        urlApi: "http://localhost:9080/prueba/api",
        solicitar: async (url, opciones) => {
            assert.equal(url, "http://localhost:9080/prueba/api/cajas");
            assert.deepEqual(opciones, {
                method: "GET",
                headers: { Accept: "application/json" },
            });
            return new Response("[]");
        },
    });
    assert.deepEqual(await servicio.solicitarJson("cajas"), []);
});

test("POST envía JSON y devuelve el registro creado con HTTP 201", async () => {
    const datos = { nombre: "Caja de prueba", activo: true };
    const servicio = new DefaultService({
        solicitar: async (url, opciones) => {
            assert.match(url, /\/api\/cajas$/);
            assert.equal(opciones.method, "POST");
            assert.equal(opciones.headers["Content-Type"], "application/json");
            assert.deepEqual(JSON.parse(opciones.body), datos);
            return new Response('{"idCaja":"prueba"}', { status: 201 });
        },
    });
    const respuesta = await servicio.solicitarJson("cajas", { metodo: "POST", datos });
    assert.deepEqual(respuesta, { idCaja: "prueba" });
});

test("HTTP 204 devuelve null aunque no haya cuerpo", async () => {
    const servicio = new DefaultService({
        solicitar: async () => new Response(null, { status: 204 }),
    });
    assert.equal(await servicio.solicitarJson("cajas/prueba", { metodo: "DELETE" }), null);
});

test("HTTP 422 conserva el mensaje, código y detalle de validación", async () => {
    const servicio = new DefaultService({
        solicitar: async () => new Response(
            '{"codigo":"API-422","mensaje":"Datos inválidos","detalle":"El nombre es obligatorio"}',
            { status: 422 },
        ),
    });
    await assert.rejects(servicio.solicitarJson("cajas"), {
        estado: 422,
        codigo: "API-422",
        message: "Datos inválidos",
        detalle: "El nombre es obligatorio",
    });
});

test("HTTP 500 sin JSON conserva el estado con un mensaje genérico", async () => {
    const servicio = new DefaultService({
        solicitar: async () => new Response("<html>Error interno</html>", { status: 500 }),
    });
    await assert.rejects(servicio.solicitarJson("cajas"), {
        estado: 500,
        message: "La API respondió HTTP 500.",
    });
});

test("HTTP 200 con cuerpo malformado informa una respuesta inválida", async () => {
    const servicio = new DefaultService({
        solicitar: async () => new Response("{"),
    });
    await assert.rejects(servicio.solicitarJson("cajas"), {
        estado: 200,
        codigo: "RESPUESTA_INVALIDA",
    });
});

test("si fetch rechaza, el error de conexión no tiene estado HTTP", async () => {
    const servicio = new DefaultService({
        solicitar: async () => { throw new TypeError("Failed to fetch"); },
    });
    await assert.rejects(servicio.solicitarJson("cajas"), error =>
        error instanceof DefaultError && error.codigo === "CONEXION" && error.estado === null);
});
