import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Recepcion, OrdenService } from '../../../src/control/recepcion.js';
import DefaultError from '../../../src/entity/default_error.js';
const diferida = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
test('consulta endpoints reales sin almacenar respuesta', async () => {
    const llamadas=[];
    const servicio = new OrdenService({ solicitar: async (url, opciones) => { llamadas.push({url,opciones}); return new Response('[]'); } });
    assert.deepEqual(await servicio.pendientes(), []); assert.deepEqual(await servicio.productos('orden-1'), []);
    assert.ok(llamadas[0].url.endsWith('/ordenes/pendientes'));
    assert.ok(llamadas[1].url.endsWith('/ordenes/orden-1/productos'));
    assert.ok(llamadas.every(c => c.opciones.cache === 'no-store'));
});
test('listado, selección, productos y actualización limpia selección', async () => {
    const modelo = new Recepcion({ pendientes: async () => [{idOrden:'a'}], productos: async id => [{producto:id}] });
    await modelo.actualizar(); assert.equal(modelo.ordenes.length,1);
    await modelo.seleccionar('a'); assert.equal(modelo.seleccion,'a'); assert.deepEqual(modelo.productos,[{producto:'a'}]);
    await modelo.actualizar(); assert.equal(modelo.seleccion,null); assert.deepEqual(modelo.productos,[]);
});
test('lista vacía y selección desconocida', async () => {
    const modelo = new Recepcion({ pendientes: async () => [] });
    await modelo.actualizar(); await modelo.seleccionar('no-existe');
    assert.deepEqual(modelo.ordenes,[]); assert.equal(modelo.seleccion,null); assert.equal(modelo.error,'');
});
test('HTTP DefaultError y carga', async () => {
    const respuesta = diferida(); const modelo = new Recepcion({pendientes: () => respuesta.promise});
    const carga=modelo.actualizar(); assert.equal(modelo.cargando,true);
    respuesta.reject(new DefaultError('Error del servidor',{estado:500})); await carga;
    assert.match(modelo.error,/HTTP 500/); assert.equal(modelo.cargando,false);
});
for (const falla of [false,true]) test(`cambio rápido descarta respuesta vieja (error=${falla})`, async () => {
    const a=diferida(), b=diferida();
    const modelo=new Recepcion({pendientes:async()=>[{idOrden:'a'},{idOrden:'b'}], productos:id=>id==='a'?a.promise:b.promise});
    await modelo.actualizar(); const primera=modelo.seleccionar('a'); const segunda=modelo.seleccionar('b');
    b.resolve([{producto:'B'}]); await segunda;
    if(falla) a.reject(new DefaultError('Fallo antiguo')); else a.resolve([{producto:'A'}]);
    await primera; assert.equal(modelo.seleccion,'b'); assert.deepEqual(modelo.productos,[{producto:'B'}]); assert.equal(modelo.error,'');
});
test('actualizar invalida productos en vuelo', async () => {
    const pendiente=diferida(); const modelo=new Recepcion({pendientes:async()=>[{idOrden:'a'}], productos:()=>pendiente.promise});
    await modelo.actualizar(); const seleccion=modelo.seleccionar('a'); await modelo.actualizar();
    pendiente.resolve([{producto:'Viejo'}]); await seleccion; assert.deepEqual(modelo.productos,[]); assert.equal(modelo.seleccion,null);
});
test('offline no consulta API ni conserva datos anteriores', async () => {
    let consultas=0; const modelo=new Recepcion({pendientes:async()=>{consultas++;return [];}},()=>{},()=>false);
    await modelo.actualizar(); assert.equal(consultas,0); assert.match(modelo.error,/conexión/);
    modelo.ordenes=[{idOrden:'a'}]; modelo.productos=[{}]; modelo.desconectar(); assert.deepEqual(modelo.ordenes,[]); assert.deepEqual(modelo.productos,[]);
});
