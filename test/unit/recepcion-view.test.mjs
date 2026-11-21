import { test } from 'node:test';
import assert from 'node:assert/strict';

class Elemento {
    children = []; dataset = {}; attrs = {}; textContent = ''; isConnected = true;
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = items; this.textContent = ''; }
    setAttribute(k, v) { this.attrs[k] = v; }
}
async function vista(t) {
    const prev = new Map();
    for (const [k, v] of Object.entries({HTMLElement: Elemento,
        customElements: {define() {}}, document: {createElement: () => new Elemento()}})) {
        prev.set(k, Object.getOwnPropertyDescriptor(globalThis, k));
        Object.defineProperty(globalThis, k, {value: v, configurable: true});
    }
    t.after(() => { for (const [k, v] of prev) { if (v) Object.defineProperty(globalThis, k, v); else delete globalThis[k]; } });
    const {RecepcionView} = await import(`../../src/boundary/recepcion-view.js?${t.name}`);
    const v = new RecepcionView();
    const nodos = Object.fromEntries(['[role=status]', '.ordenes', '.productos', '.actualizar', '.seleccion'].map(k => [k, new Elemento()]));
    v.querySelector = k => nodos[k];
    v.modelo = {ordenes: [], productos: [], seleccion: null, cargando: false, cargandoProductos: false, error: ''};
    return {v, nodos};
}
test('Recepción renderiza carga, vacío y error de permisos', async t => {
    const {v, nodos: n} = await vista(t);
    v.modelo.cargando = true; v.render();
    assert.equal(n['.actualizar'].disabled, true);
    assert.equal(n['.ordenes'].attrs['aria-busy'], 'true');
    assert.match(n['[role=status]'].textContent, /Cargando/);
    v.modelo.cargando = false; v.render();
    assert.match(n['.ordenes'].textContent, /No hay órdenes pendientes/);
    v.modelo.error = 'Tu rol no permite acceder a Recepción.'; v.render();
    assert.equal(n['[role=status]'].dataset.error, 'true');
    assert.match(n['[role=status]'].textContent, /Tu rol/);
});
test('Recepción selecciona orden y muestra nombre, notas y precio sin preparación', async t => {
    const {v, nodos: n} = await vista(t);
    let elegida;
    v.modelo.ordenes = [{idOrden: 'orden-prueba', fechaCreacion: '2026-11-18T12:00:00Z'}];
    v.modelo.seleccionar = id => { elegida = id; };
    v.render(); n['.ordenes'].children[0].onclick();
    assert.equal(elegida, 'orden-prueba');
    v.modelo.seleccion = elegida;
    v.modelo.productos = [{idProducto: 'producto', producto: 'Café', precio: 2.5, observaciones: 'Cliente: Ana | Sin azúcar'}];
    v.render();
    const item = n['.productos'].children[0];
    assert.match(item.children[0].textContent, /Café/);
    assert.match(item.children[1].textContent, /2.50/);
    assert.match(item.children[2].textContent, /Cliente: Ana.*Sin azúcar/);
    assert.equal(n['.productos'].children.length, 1);
    v.modelo.productos = []; v.render();
    assert.match(n['.productos'].textContent, /no tiene productos/);
});

test('Recepción muestra cliente, pago y avance local sin confundir sus estados', async t => {
    const {v, nodos: n} = await vista(t);
    const {PreparacionLocal} = await import('../../src/entity/preparacion-local.js');
    v.modelo.ordenes = [{idOrden:'orden-local', cliente:'Ana', estadoPago:'ABONADA_PARCIALMENTE'}];
    v.modelo.seleccion = 'orden-local';
    v.modelo.productos = [{producto:'Café',precio:2}];
    v.modelo.preparacion = new PreparacionLocal();
    v.modelo.avanzarPreparacion = id => {v.modelo.preparacion.avanzar(id);v.render();};
    v.render();
    assert.match(n['.ordenes'].children[0].children[0].textContent,/Ana.*Abonada parcialmente/);
    for (const etiqueta of ['Iniciar preparación','Marcar como lista','Marcar como despachada']) {
        const boton=n['.productos'].children[1];
        assert.equal(boton.textContent,etiqueta); boton.onclick();
        assert.equal(v.modelo.ordenes[0].estadoPago,'ABONADA_PARCIALMENTE');
    }
    assert.match(n['.productos'].children[0].textContent,/Estado de preparación: DESPACHADA/);
    assert.equal(n['.productos'].children.length,2);
    v.modelo.error='Tu rol no permite acceder a Recepción.'; v.render();
    assert.ok(n['.productos'].children.every(item=>!item.onclick));
    v.modelo.error=''; v.modelo.cargandoProductos=true; v.render();
    assert.equal(n['.productos'].attrs['aria-busy'],'true');
    assert.ok(n['.productos'].children.every(item=>!item.onclick));
});
