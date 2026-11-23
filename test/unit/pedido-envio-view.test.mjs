import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const id='11111111-1111-4111-8111-111111111111';
async function preparar(t) {
    let Vista;
    for (const [k,value] of Object.entries({HTMLElement:class{},document:{createElement:()=>({}),removeEventListener(){}},window:{removeEventListener(){}},customElements:{define:(_,v)=>Vista=v},navigator:{onLine:true}})) {
        const old=Object.getOwnPropertyDescriptor(globalThis,k);
        Object.defineProperty(globalThis,k,{value,configurable:true});
        t.after(()=>old?Object.defineProperty(globalThis,k,old):delete globalThis[k]);
    }
    await import(`../../src/boundary/pedido-publico-view.js?${t.name}`);
    const v=Object.create(Vista.prototype), nodos=new Map();
    v.elemento=id=>{if(!nodos.has(id))nodos.set(id,{hidden:false,textContent:'',focus(){this.enfocado=true;}});return nodos.get(id);};
    v.carrito=new Map([[id,{nombre:'Café',cantidad:1,precioCentavos:250}]]);
    v.nombre={value:'Ana',disabled:false};v.resultado={textContent:''};
    v.versionEnvio=0;v.solicitudProductos=0;v.solicitudCategorias=0;
    v.categoria={idTipoProducto:'bebidas'};
    v.mostrarCarrito=()=>{v.elemento('enviar').disabled=v.enviando || !v.carrito.size;};
    v.mostrarProductos=()=>{};v.mostrarConexion=()=>{};
    v.cargarCategorias=()=>{v.recargas=(v.recargas||0)+1;};
    v.dispatchEvent=()=>{};
    v.servicio={invalidar(){},enviar:async()=>({idOrden:id,total:2.5})};
    return v;
}
const enviar=v=>v.enviar({preventDefault(){}});
test('marca es texto normal y no conserva evento de enlace',async()=>{
    const html=await readFile(new URL('../../src/index.html',import.meta.url),'utf8');
    assert.match(html,/<div class="marca"/);assert.doesNotMatch(html,/<a[^>]*class="marca"/);
    const app=await readFile(new URL('../../src/boundary/app.js',import.meta.url),'utf8');
    assert.doesNotMatch(app,/querySelector\('\.marca'\)\.onclick/);
});
test('éxito confirmado limpia formulario, vuelve a tipos y muestra banner exactamente 5 segundos',async t=>{
    const v=await preparar(t);t.mock.timers.enable({apis:['setTimeout']});
    await enviar(v);
    assert.equal(v.carrito.size,0);assert.equal(v.nombre.value,'');assert.equal(v.resultado.textContent,'');
    assert.equal(v.categoria,null);assert.equal(v.elemento('vista-tipos').hidden,false);
    assert.equal(v.elemento('seccion-productos').hidden,true);assert.equal(v.recargas,1);
    const banner=v.elemento('notificacion-exito');assert.equal(banner.hidden,false);
    assert.equal(banner.textContent,'¡Pedido enviado correctamente!');assert.doesNotMatch(banner.textContent,/11111111|2.50/);
    t.mock.timers.tick(4999);assert.equal(banner.hidden,false);
    t.mock.timers.tick(1);assert.equal(banner.hidden,true);assert.equal(banner.textContent,'');
});
test('nueva notificación sustituye temporizador anterior y se limpia al desmontar',async t=>{
    const v=await preparar(t);t.mock.timers.enable({apis:['setTimeout']});
    v.mostrarExito();t.mock.timers.tick(3000);v.mostrarExito();t.mock.timers.tick(2000);
    assert.equal(v.elemento('notificacion-exito').hidden,false);
    v.disconnectedCallback();assert.equal(v.elemento('notificacion-exito').hidden,true);
    t.mock.timers.tick(5000);assert.equal(v.elemento('notificacion-exito').textContent,'');
});
test('fallo conserva carrito y nombre, no navega y mantiene error',async t=>{
    const v=await preparar(t);t.mock.timers.enable({apis:['setTimeout']});
    v.servicio.enviar=async()=>{throw new Error('No hay conexión con el servidor');};
    await enviar(v);t.mock.timers.tick(6000);
    assert.equal(v.carrito.size,1);assert.equal(v.nombre.value,'Ana');assert.equal(v.categoria.idTipoProducto,'bebidas');
    assert.match(v.resultado.textContent,/No hay conexión/);assert.equal(v.elemento('notificacion-exito').hidden,true);
});
test('doble clic envía una sola petición y no limpia ni navega antes de confirmación',async t=>{
    const v=await preparar(t);t.mock.timers.enable({apis:['setTimeout']});let resolver, llamadas=0;
    v.servicio.enviar=()=>{llamadas++;return new Promise(r=>resolver=r);};
    const pendiente=enviar(v);await enviar(v);
    assert.equal(llamadas,1);assert.equal(v.carrito.size,1);assert.equal(v.categoria.idTipoProducto,'bebidas');
    resolver({idOrden:id});await pendiente;assert.equal(v.carrito.size,0);
});
test('offline o respuesta sin confirmación no anuncian éxito ni borran el pedido',async t=>{
    const v=await preparar(t);navigator.onLine=false;
    v.servicio.enviar=()=>assert.fail('No debe enviar offline');await enviar(v);
    assert.equal(v.carrito.size,1);assert.match(v.resultado.textContent,/conexión/);
    navigator.onLine=true;v.servicio.enviar=async()=>null;await enviar(v);
    assert.equal(v.carrito.size,1);assert.match(v.resultado.textContent,/confirmar/);
    assert.equal(v.elemento('notificacion-exito').hidden,true);
});
test('error de categorías anterior no sobrescribe una carga más reciente',async t=>{
    const v=await preparar(t);let rechazar;
    v.servicio.listarCategorias=()=>new Promise((_,reject)=>{rechazar=reject;});
    const cargar=Object.getPrototypeOf(v).cargarCategorias;
    const anterior=cargar.call(v);
    v.servicio.listarCategorias=async()=>[];v.servicio.aviso=()=>'';
    v.mostrarCategorias=()=>{v.elemento('estado-categorias').textContent='Catálogo vigente';};
    await cargar.call(v);rechazar(new Error('Fallo antiguo'));await anterior;
    assert.equal(v.elemento('estado-categorias').textContent,'Catálogo vigente');
    assert.equal(v.elemento('reintentar-categorias').hidden,true);
});
test('una confirmación recibida tras desmontar no navega ni anuncia éxito',async t=>{
    const v=await preparar(t);let resolver;
    v.servicio.enviar=()=>new Promise(r=>{resolver=r;});
    const pendiente=enviar(v);v.disconnectedCallback();resolver({idOrden:id});await pendiente;
    assert.equal(v.carrito.size,1);assert.equal(v.categoria.idTipoProducto,'bebidas');
    assert.equal(v.elemento('notificacion-exito').hidden,true);
});
