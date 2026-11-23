import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../../src/', import.meta.url);
const leer = ruta => readFile(new URL(ruta, root), 'utf8');
test('manifiesto e iconos locales con dimensiones correctas', async () => {
    const manifest=JSON.parse(await leer('manifest.webmanifest'));
    assert.equal(manifest.scope,'./'); assert.equal(manifest.display,'standalone');
    for(const icono of manifest.icons) {
        const bytes=await readFile(new URL(icono.src,root)); const size=Number(icono.sizes.split('x')[0]);
        assert.equal(bytes.readUInt32BE(16),size); assert.equal(bytes.readUInt32BE(20),size);
    }
});
async function worker({scope='/sub/', online=false}={}) {
    const eventos={}; const almacen=new Map(); const borrados=[]; let redes=0; let activado=false; const peticiones=[];
    const cache={addAll:async urls=>{for(const url of urls) almacen.set(url,{url,cache:true});},match:async key=>almacen.get(key),put:async(key,value)=>almacen.set(key,value)};
    const context={ URL, Set, caches:{open:async()=>cache,keys:async()=>[...Array.from({length:15},(_,i)=>`cafefe-shell-v${i}`),'otro-proyecto','cafefe-shell-%2Fotra%2F-v23','datos-usuario'],delete:async key=>borrados.push(key)},
        self:{skipWaiting:async()=>{activado=true;},location:{href:`http://localhost:5501${scope}sw.js`}, clients:{claim:async()=>{}},addEventListener:(tipo,callback)=>eventos[tipo]=callback},
        fetch:async(request,options)=>{redes++;peticiones.push({request,options});if(online)return {ok:true,api:'9080',clone(){return this;}};throw new Error('offline');} };
    vm.runInNewContext(await leer('sw.js'),context);
    let tarea; eventos.install({waitUntil:p=>tarea=p}); await tarea;
    return {eventos,almacen,borrados,peticiones,activado,redes:()=>redes};
}
test('precache completo, aislamiento de alcance y limpieza por versión', async () => {
    const w=await worker();
    for(const url of w.almacen.keys()) await access(new URL(url.split('/sub/')[1],root));
    let tarea; w.eventos.activate({waitUntil:p=>tarea=p}); await tarea;
    assert.deepEqual(w.borrados,[]); // /sub/ no debe borrar la caché de la aplicación raíz.
});
test('shell abre offline; API y mutaciones nunca se interceptan', async () => {
    const w=await worker(); let respuesta;
    w.eventos.fetch({request:{url:'http://localhost:5501/sub/#/recepcion',method:'GET',mode:'navigate'},respondWith:p=>respuesta=p});
    assert.equal((await respuesta).cache,true); assert.equal(w.redes(),0);
    for(const [url,method] of [['http://localhost:9080/api/ordenes','GET'],['http://localhost:5501/sub/api/login','POST'],['http://localhost:5501/sub/index.html?uuid=secreto','GET'],['http://localhost:5501/otro/','GET'],['http://localhost:5501/sub/index.html','DELETE']]) {
        let interceptado=false;
        w.eventos.fetch({request:{url,method,mode:'navigate'},respondWith:()=>interceptado=true}); assert.equal(interceptado,false);
    }
});
test('registro relativo y ausencia de persistencia de credenciales', async () => {
    assert.match(await leer('control/pwa.js'),/serviceWorker.register/);
    for(const archivo of ['control/acceso.js','boundary/login-view.js','boundary/app.js','control/pwa.js'])
        assert.doesNotMatch(await leer(archivo),/localStorage|sessionStorage|console\.(log|debug)|indexedDB/);
});

test('configuración usa red antes de caché y conserva alternativa offline', async () => {
    const url='http://localhost:5501/sub/config/api.js';
    const w=await worker({online:true});
    w.almacen.set(url,{api:'puerto temporal apagado'});
    let respuesta;
    w.eventos.fetch({request:{url,method:'GET'},respondWith:p=>respuesta=p});
    assert.equal((await respuesta).api,'9080');
    assert.equal(w.almacen.get(url).api,'9080');
    assert.equal(w.peticiones[0].options.cache,'no-store');
    const offline=await worker();
    offline.eventos.fetch({request:{url,method:'GET'},respondWith:p=>respuesta=p});
    assert.equal((await respuesta).cache,true);
    assert.equal(offline.redes(),1);
});
test('actualización raíz elimina solo shell antiguo y no datos ni otros alcances', async () => {
    const w=await worker({scope:'/'}); let tarea;
    assert.equal(w.activado,true);
    w.eventos.activate({waitUntil:p=>tarea=p}); await tarea;
    assert.equal(w.borrados.length,15);
    assert.ok(w.borrados.every(nombre=>/^cafefe-shell-v\d+$/.test(nombre)));
});
