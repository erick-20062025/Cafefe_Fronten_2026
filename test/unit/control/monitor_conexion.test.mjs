import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MonitorConexion } from '../../../src/control/monitor_conexion.js';

async function caso(estadoHttp, conectado = true) {
    const cambios = [];
    let opciones;
    const monitor = new MonitorConexion({
        apiUrl: 'http://localhost:18080/cafefe/api/',
        conectado: () => conectado,
        solicitar: async (url, config) => { opciones = { url, config }; return {status:estadoHttp}; },
        cambiar: estado => cambios.push(estado),
    });
    monitor.activo = true;
    await monitor.comprobar();
    monitor.detener = () => { monitor.activo = false; };
    monitor.detener();
    return {cambios, opciones};
}
test('401 anónimo y 200 autenticado son servidor operativo', async () => {
    for (const estado of [200,401]) {
        const {cambios, opciones} = await caso(estado);
        assert.deepEqual(cambios,['operativo']);
        assert.match(opciones.url,/\/cafefe\/api\/sesion$/);
        assert.equal(opciones.config.cache,'no-store');
        assert.equal(opciones.config.credentials,'include');
    }
});
test('502, 503 y 404 no se interpretan como backend operativo', async () => {
    for (const estado of [502,503,404]) assert.deepEqual((await caso(estado)).cambios,['servidor']);
});
test('navegador sin red no consulta la API', async () => {
    const {cambios,opciones} = await caso(200,false);
    assert.deepEqual(cambios,['sin-red']);
    assert.equal(opciones,undefined);
});
test('fallo de fetch es caída de servidor aunque navigator.onLine sea true', async () => {
    const cambios=[];
    const monitor = new MonitorConexion({apiUrl:'http://localhost/cafefe/api/',
        conectado:()=>true,solicitar:async()=>{throw Error('ECONNREFUSED')},cambiar:s=>cambios.push(s)});
    monitor.activo=true;await monitor.comprobar();assert.deepEqual(cambios,['servidor']);
});
test('recuperación limpia la alerta y no repite estados', async () => {
    const cambios=[];let estado=502;
    const monitor=new MonitorConexion({apiUrl:'http://localhost/cafefe/api/',
        conectado:()=>true,solicitar:async()=>({status:estado}),cambiar:s=>cambios.push(s)});
    monitor.activo=true;
    await monitor.comprobar();await monitor.comprobar();estado=401;await monitor.comprobar();
    assert.deepEqual(cambios,['servidor','operativo']);
});
