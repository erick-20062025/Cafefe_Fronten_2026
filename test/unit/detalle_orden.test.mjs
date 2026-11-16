import {test} from 'node:test';
import assert from 'node:assert/strict';
import {agruparProductos} from '../../src/entity/detalle_orden.js';
test('agrupa unidades iguales sin perder precio ni características',()=>{
 const fila={idProducto:'a',producto:'Café',precio:4,precioBase:5,descuento:1,caracteristicas:'Tamaño: 12 oz'};
 const resultado=agruparProductos([fila,{...fila}]); assert.equal(resultado.length,1);assert.equal(resultado[0].cantidad,2);assert.equal(resultado[0].descuento,1);assert.equal(fila.cantidad,undefined);
});
test('separa preparaciones y precios distintos',()=>{const f={idProducto:'a',producto:'Café',precio:4};assert.equal(agruparProductos([f,{...f,observaciones:'Sin azúcar'},{...f,precio:5}]).length,3);});
