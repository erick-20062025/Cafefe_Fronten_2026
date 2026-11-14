import DefaultService from "../../src/control/default_service.js";

const servicio = new DefaultService();
const boton = document.querySelector("#probar");
const resultado = document.querySelector("#resultado");

async function probarConsulta() {
    boton.disabled = true;
    resultado.textContent = "Consultando cajas…";

    try {
        const cajas = await servicio.solicitarJson("cajas");
        if (!Array.isArray(cajas)) {
            throw new Error("Se esperaba una lista de cajas.");
        }
        resultado.textContent = `OK · Se recibió una lista de ${cajas.length} cajas.`;
    } catch (error) {
        const estado = error.estado ? `HTTP ${error.estado} · ` : "";
        resultado.textContent = `FALLÓ · ${estado}${error.message}`;
    } finally {
        boton.disabled = false;
    }
}

boton.addEventListener("click", probarConsulta);
probarConsulta();
