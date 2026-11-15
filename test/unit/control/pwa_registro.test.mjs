import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrarPwa } from '../../../src/control/pwa.js';
async function entorno(serviceWorker, ejecutar) {
    const ventana = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const navegador = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const eventos = {};
    Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:(nombre,fn)=>eventos[nombre]=fn}});
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:serviceWorker?{serviceWorker}:{}});
    try { await ejecutar(eventos); } finally {
        if(ventana) Object.defineProperty(globalThis,'window',ventana); else delete globalThis.window;
        if(navegador) Object.defineProperty(globalThis,'navigator',navegador); else delete globalThis.navigator;
    }
}
test('registra worker relativo, espera activación e instala solo a solicitud', async () => {
    let opciones; let prompts=0;
    await entorno({register:async(url,config)=>opciones={url,config},ready:Promise.resolve()},async eventos=>{
        const boton={hidden:true}; const estado={textContent:''};
        await registrarPwa(boton,estado);
        assert.ok(opciones.url.pathname.endsWith('/sw.js'));
        assert.equal(opciones.config.scope, new URL('../../../',import.meta.url).pathname);
        assert.match(estado.textContent,/disponibles/); assert.equal(prompts,0);
        eventos.beforeinstallprompt({preventDefault(){},prompt:async()=>prompts++,userChoice:Promise.resolve({outcome:'accepted'})});
        assert.equal(boton.hidden,false); await boton.onclick(); assert.equal(prompts,1); assert.equal(boton.hidden,true);
        eventos.appinstalled(); assert.match(estado.textContent,/instalada/);
    });
});
test('informa registro fallido sin afirmar disponibilidad offline', async () => {
    await entorno({register:async()=>{throw new Error('fallo');}},async()=>{
        const estado={}; await registrarPwa({},estado); assert.match(estado.textContent,/No se pudo/);
    });
});
test('informa navegador sin soporte', async () => {
    await entorno(null,async()=>{const estado={};await registrarPwa({},estado);assert.match(estado.textContent,/no admite/);});
});
