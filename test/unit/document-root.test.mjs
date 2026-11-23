import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, access} from 'node:fs/promises';
import {join, resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const src=fileURLToPath(new URL('../../src/',import.meta.url));
async function archivos(directorio) {
    const salida=[];
    for (const entrada of await readdir(directorio,{withFileTypes:true})) {
        const ruta=join(directorio,entrada.name);
        if(entrada.isDirectory()) salida.push(...await archivos(ruta)); else salida.push(ruta);
    }
    return salida;
}
test('src contiene entrada y todas las importaciones, estilos e imágenes del shell',async()=>{
    const html=await readFile(join(src,'index.html'),'utf8');
    for(const coincidencia of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)) await access(resolve(src,coincidencia[1]));
    for(const archivo of await archivos(src)) {
        if(!archivo.endsWith('.js')) continue;
        const codigo=await readFile(archivo,'utf8');
        for(const coincidencia of codigo.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
            const destino=resolve(dirname(archivo),coincidencia[1]);
            assert.ok(!relative(src,destino).startsWith('..'),archivo);
            await access(destino);
        }
    }
});
test('worker anterior retira solo su shell sin interceptar API ni borrar datos',async()=>{
    const eventos={};const borrados=[];
    const codigo=await readFile(new URL('../../sw.js',import.meta.url),'utf8');
    vm.runInNewContext(codigo,{URL,self:{location:{href:'http://localhost/sw.js'},skipWaiting:async()=>{},clients:{claim:async()=>{}},addEventListener:(n,f)=>eventos[n]=f},
        caches:{keys:async()=>['cafefe-shell-%2F-v27','cafefe-shell-%2Fsrc%2F-v28','datos-usuario','cafefe-shell-v1'],delete:async n=>borrados.push(n)}});
    let fin;eventos.activate({waitUntil:p=>fin=p});await fin;
    assert.deepEqual(borrados,['cafefe-shell-%2F-v27','cafefe-shell-v1']);
    assert.equal(eventos.fetch,undefined);
});
