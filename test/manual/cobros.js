import "../../src/boundary/cobros-view.js";
import DefaultService from "../../src/control/default_service.js";

const selector = document.querySelector("#cajero");
const estado = document.querySelector("#estado");
const destino = document.querySelector("#vista");
const servicio = new DefaultService();

function mostrarCobros() {
    const vista = document.createElement("cafefe-cobros");
    vista.servicio = servicio;
    vista.idEmpleadoRol = selector.value;
    destino.replaceChildren(vista);
}

async function cargarCajeros() {
    try {
        const [empleados, roles, asignaciones] = await Promise.all(
            ["empleados", "roles", "empleado-roles"].map(ruta => servicio.solicitarJson(ruta)),
        );
        const activos = new Map(empleados.filter(empleado => empleado.activo)
            .map(empleado => [empleado.idEmpleado, empleado]));
        const rolesCaja = new Set(roles.filter(rol => rol.activo && rol.nombre.trim().toLowerCase() === "cajero")
            .map(rol => rol.idRol));
        const cajeros = asignaciones.filter(asignacion => asignacion.activo
            && activos.has(asignacion.idEmpleado) && rolesCaja.has(asignacion.idRol));
        for (const asignacion of cajeros) {
            const empleado = activos.get(asignacion.idEmpleado);
            const nombre = [empleado.nombre, empleado.apellido].filter(Boolean).join(" ");
            selector.add(new Option(nombre, asignacion.idEmpleadoRol));
        }
        selector.disabled = cajeros.length === 0;
        if (cajeros.length === 1) selector.value = cajeros[0].idEmpleadoRol;
        estado.textContent = cajeros.length ? "" : "No hay cajeros activos. Podés consultar los comprobantes.";
    } catch (error) {
        estado.textContent = "No se pudieron cargar los cajeros. " + (error.detalle || error.message);
    }
    mostrarCobros();
}

if (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) {
    selector.addEventListener("change", mostrarCobros);
    cargarCajeros();
} else {
    estado.textContent = "Abrí esta prueba con el servidor del frontend en localhost.";
}
