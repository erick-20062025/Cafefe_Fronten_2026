import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Acceso, permite, validarCredenciales } from '../../../src/control/acceso.js';
const uuid = '12345678-1234-1234-1234-123456789abc';
const empleado = roles => ({ nombre: 'Prueba', activo: true, roles });
test('campos vacíos y UUID inválido', () => {
    for (const [nombre, clave] of [['', uuid], ['Ana', ''], ['Ana', 'abc']]) assert.throws(() => validarCredenciales(nombre, clave));
    assert.doesNotThrow(() => validarCredenciales('Ana', uuid));
});
for (const estado of [401,403,404]) test(`credenciales incorrectas/inexistentes HTTP ${estado} no exponen detalle`, async () => {
    const acceso = new Acceso(async () => { throw { estado, message: uuid }; });
    await assert.rejects(acceso.entrar('Ana', uuid), error => !error.message.includes(uuid));
    assert.equal(acceso.sesion, null);
});
for (const respuesta of [null, {...empleado(['barista']), activo:false}, empleado([]), empleado(['administrador'])])
    test('rechaza empleado inactivo o sin roles permitidos', async () => {
        const acceso = new Acceso(async () => respuesta);
        await assert.rejects(acceso.entrar('Ana', uuid)); assert.equal(acceso.sesion, null);
    });
for (const rol of ['barista','cocinero']) test(`Recepción permite ${rol}, Cobros rechaza`, async () => {
    const acceso = new Acceso(async () => empleado([rol]));
    assert.equal(acceso.solicitar('recepcion'), 'login');
    assert.equal(await acceso.entrar('Ana', uuid), 'recepcion');
    assert.equal(acceso.solicitar('cobros'), 'prohibido');
    assert.equal(permite(acceso.sesion, 'recepcion'), true);
    assert.ok(!JSON.stringify(acceso).includes(uuid));
});
test('restaura ruta de Cobros y cierre elimina acceso', async () => {
    let cierre = false;
    const acceso = new Acceso(async () => empleado(['cajero']), async () => { cierre = true; });
    assert.equal(acceso.solicitar('cobros'), 'login');
    assert.equal(await acceso.entrar('Ana', uuid), 'cobros');
    await acceso.cerrar(); assert.equal(cierre, true); assert.equal(acceso.sesion, null);
    assert.equal(acceso.solicitar('recepcion'), 'login');
});
test('sin adaptador aprobado nunca simula sesión', async () => {
    const acceso = new Acceso(); await assert.rejects(acceso.entrar('Ana', uuid), /pendiente/);
    assert.equal(acceso.sesion, null);
});
