import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SesionService} from '../../../src/control/sesion_service.js';
import {Acceso} from '../../../src/control/acceso.js';
test('sesión usa DefaultService con cookies, no-store y URL sin credenciales', async()=>{
    const llamadas=[];
    const servicio=new SesionService({solicitar:async(url, opciones)=>{
        llamadas.push({url,opciones}); return opciones.method==='DELETE'?new Response(null,{status:204}):new Response('{"nombre":"Prueba","activo":true,"roles":["cajero"]}');
    }});
    await servicio.entrar('Prueba','uuid-de-prueba'); await servicio.recuperar(); await servicio.cerrar();
    assert.deepEqual(llamadas.map(c=>c.opciones.method),['POST','GET','DELETE']);
    for(const c of llamadas){ assert.equal(c.opciones.credentials,'include');assert.equal(c.opciones.cache,'no-store');assert.equal(new URL(c.url).hostname,'127.0.0.1');assert.ok(!c.url.includes('uuid-de-prueba')); }
    assert.deepEqual(JSON.parse(llamadas[0].opciones.body),{nombre:'Prueba',uuid:'uuid-de-prueba'});
});
test('restauración conserva destino y cierre invalida recuperación tardía', async()=>{
    let resolver;
    const acceso=new Acceso(null,null,()=>new Promise(r=>resolver=r));
    acceso.solicitar('cobros');const pendiente=acceso.recuperar();await acceso.cerrar();
    resolver({nombre:'Prueba',activo:true,roles:['cajero']});await pendiente;assert.equal(acceso.sesion,null);
    acceso.recuperarServidor=async()=>({nombre:'Prueba',activo:true,roles:['cajero']});
    acceso.solicitar('cobros');await acceso.recuperar();assert.equal(acceso.solicitar('cobros'),'cobros');
});
test('sesión expirada se descarta sin confundir un fallo de conexión', async()=>{
    const acceso=new Acceso(null,null,async()=>{throw {estado:401};});
    await acceso.recuperar();assert.equal(acceso.sesion,null);
    acceso.recuperarServidor=async()=>{throw {estado:503};};await assert.rejects(acceso.recuperar());
});
