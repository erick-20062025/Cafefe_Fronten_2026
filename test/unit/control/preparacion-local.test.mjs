import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PreparacionLocal} from '../../../src/entity/preparacion-local.js';
import {Recepcion} from '../../../src/control/recepcion.js';
test('preparación recorre estados sin compartir ni persistir', () => {
 const a = new PreparacionLocal(), b = new PreparacionLocal();
 assert.equal(a.estado('1'), 'PENDIENTE');
 for (const estado of ['PREPARANDO','LISTA','DESPACHADA','DESPACHADA']) assert.equal(a.avanzar('1'), estado);
 assert.equal(b.estado('1'), 'PENDIENTE');
 a.conservar([]); assert.equal(a.estado('1'), 'PENDIENTE');
});
test('avanzar reacciona sin llamar al API ni cambiar pago', () => {
 let cambios=0;
 const m = new Recepcion({pendientes:()=>assert.fail('No consultar')},()=>cambios++);
 m.ordenes=[{idOrden:'1',estadoPago:'ABONADA_PARCIALMENTE'}];
 m.avanzarPreparacion('1');
 assert.equal(m.preparacion.estado('1'), 'PREPARANDO');
 assert.equal(m.ordenes[0].estadoPago, 'ABONADA_PARCIALMENTE');
 assert.equal(cambios,1);
 m.avanzarPreparacion('desconocida'); assert.equal(cambios,1);
});
