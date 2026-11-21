import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolverRuta} from '../../src/control/navegacion.js';
const leer=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
test('menú y precaché no enlazan a la gestión de cancelaciones retirada',async()=>{
    assert.equal(resolverRuta('#/mis-ordenes',{}),'no-encontrada');
    for(const p of ['src/boundary/app.js','sw.js'])
        assert.doesNotMatch(await leer(p),/mis-ordenes|gestion-ordenes|Cancelar orden/);
});
test('aviso offline visible, rojo y accesible; desaparece al recuperar catálogo',async t=>{
    let Vista;
    for(const [k,v] of Object.entries({HTMLElement:class{},document:{createElement:()=>({})},customElements:{define:(_,c)=>Vista=c},navigator:{onLine:true}})){
        const old=Object.getOwnPropertyDescriptor(globalThis,k);
        Object.defineProperty(globalThis,k,{value:v,configurable:true});
        t.after(()=>old?Object.defineProperty(globalThis,k,old):delete globalThis[k]);
    }
    await import('../../src/boundary/pedido-publico-view.js');
    const aviso={};const v=Object.create(Vista.prototype);v.elemento=()=>aviso;
    let respaldo='';v.servicio={aviso:()=>respaldo};
    v.mostrarConexion();assert.equal(aviso.hidden,true);
    navigator.onLine=false;v.mostrarConexion();assert.equal(aviso.hidden,false);assert.match(aviso.textContent,/SIN CONEXIÓN/);
    navigator.onLine=true;respaldo='Catálogo guardado';v.mostrarConexion();assert.equal(aviso.hidden,false);
    respaldo='';v.mostrarConexion();assert.equal(aviso.hidden,true);assert.equal(aviso.textContent,'');
    assert.match(await leer('src/boundary/pedido-publico-view.js'),/id="aviso-conexion"[^>]*role="alert"/);
    assert.match(await leer('src/recursos/estilos/pedido_publico.css'),/color: #9f1717/);
});
