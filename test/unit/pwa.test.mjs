import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../../', import.meta.url);
const leer = ruta => readFile(new URL(ruta, root), 'utf8');
test('manifiesto e iconos locales con dimensiones correctas', async () => {
    const manifest=JSON.parse(await leer('manifest.webmanifest'));
    assert.equal(manifest.scope,'./'); assert.equal(manifest.display,'standalone');
    for(const icono of manifest.icons) {
        const bytes=await readFile(new URL(icono.src,root)); const size=Number(icono.sizes.split('x')[0]);
        assert.equal(bytes.readUInt32BE(16),size); assert.equal(bytes.readUInt32BE(20),size);
    }
});
async function worker() {
    const eventos={}; const almacen=new Map(); const borrados=[]; let redes=0;
    const cache={addAll:async urls=>{for(const url of urls) almacen.set(url,{url,cache:true});},match:async key=>almacen.get(key)};
    const context={ URL, Set, caches:{open:async()=>cache,keys:async()=>['cafefe-shell-v0','cafefe-shell-v1','cafefe-shell-v2','otro-proyecto'],delete:async key=>borrados.push(key)},
        self:{location:{href:'http://localhost:5501/sub/sw.js'}, clients:{claim:async()=>{}},addEventListener:(tipo,callback)=>eventos[tipo]=callback},
        fetch:async()=>{redes++;throw new Error('offline');} };
    vm.runInNewContext(await leer('sw.js'),context);
    let tarea; eventos.install({waitUntil:p=>tarea=p}); await tarea;
    return {eventos,almacen,borrados,redes:()=>redes};
}
test('precache completo, aislamiento de alcance y limpieza por versión', async () => {
    const w=await worker();
    for(const url of w.almacen.keys()) await access(new URL(url.split('/sub/')[1],root));
    let tarea; w.eventos.activate({waitUntil:p=>tarea=p}); await tarea;
    assert.deepEqual(w.borrados,['cafefe-shell-v0','cafefe-shell-v1']);
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
    assert.match(await leer('src/control/pwa.js'),/serviceWorker.register/);
    for(const archivo of ['src/control/acceso.js','src/boundary/login-view.js','src/boundary/app.js','src/control/pwa.js'])
        assert.doesNotMatch(await leer(archivo),/localStorage|sessionStorage|console\.(log|debug)|indexedDB/);
});
