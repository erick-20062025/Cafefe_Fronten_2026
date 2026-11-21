import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ListadosCobros} from '../../../src/control/listados-cobros.js';
const listas = [{id:'ordenes'}, {id:'pendientes'}, {id:'pagadas'}];
const diferida = () => { let resolve; const promise = new Promise(r => {resolve=r;}); return {promise,resolve}; };
test('cada lista publica al llegar sin esperar las otras y conserva errores separados', async () => {
    const lenta = diferida();
    const cambios = [];
    const modelo = new ListadosCobros({solicitarJson: ruta => {
        if(ruta.endsWith('ordenes-pendientes')) return lenta.promise;
        if(ruta.endsWith('/pendientes')) throw new Error('Sin permiso');
        return [];
    }}, listas, true, (lista, estado) => cambios.push([lista.id, estado]));
    const pendiente = modelo.actualizar();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(modelo.estados.get('ordenes').cargando, true);
    assert.equal(modelo.estados.get('pagadas').cargando, false);
    assert.deepEqual(modelo.estados.get('pagadas').registros, []);
    assert.equal(modelo.estados.get('pendientes').error, 'Sin permiso');
    lenta.resolve([{idOrden:'nueva'}]); await pendiente;
    assert.equal(modelo.estados.get('ordenes').registros[0].idOrden, 'nueva');
});
test('desconectar invalida una respuesta en vuelo', async () => {
    const lenta = diferida(); let cambios = 0;
    const modelo = new ListadosCobros({solicitarJson: () => lenta.promise}, [listas[0]], true, () => cambios++);
    const pendiente = modelo.actualizar(); modelo.invalidar(); lenta.resolve([]); await pendiente;
    assert.equal(cambios, 1);
});
