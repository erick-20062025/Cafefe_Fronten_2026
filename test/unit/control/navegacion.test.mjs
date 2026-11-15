import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverRuta } from '../../../src/control/navegacion.js';
import { Acceso } from '../../../src/control/acceso.js';
const uuid = '12345678-1234-1234-1234-123456789abc';
test('inicio público, acceso del personal y rutas desconocidas', () => {
    const acceso = new Acceso();
    for (const hash of ['', '#/', '#/pedido']) assert.equal(resolverRuta(hash, acceso), 'pedido');
    assert.equal(resolverRuta('#/login', acceso), 'login');
    for (const hash of ['#/otro', '#recepcion', '#/constructor']) assert.equal(resolverRuta(hash, acceso), 'no-encontrada');
});
for (const [rol, ruta, otra] of [['barista','recepcion','cobros'],['cocinero','recepcion','cobros'],['cajero','cobros','recepcion']]) {
    test(`navegación ${rol}: conserva destino, limita rol y cierra sesión`, async () => {
        const acceso = new Acceso(async () => ({activo:true,nombre:'Prueba',roles:[rol]}));
        assert.equal(resolverRuta(`#/${ruta}`, acceso), 'login');
        assert.equal(resolverRuta('#/login', acceso), 'login');
        assert.equal(await acceso.entrar('Prueba',uuid), ruta);
        assert.equal(resolverRuta(`#/${ruta}`, acceso), ruta);
        assert.equal(resolverRuta(`#/${otra}`, acceso), 'prohibido');
        await acceso.cerrar();
        assert.equal(resolverRuta('#/pedido',acceso),'pedido');
        assert.equal(resolverRuta(`#/${ruta}`, acceso),'login');
    });
}
