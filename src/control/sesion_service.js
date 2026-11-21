import DefaultService from './default_service.js';
// Mismo hostname que Live Server para cookies SameSite; Pedido conserva su contrato.
export class SesionService extends DefaultService {
    constructor({ solicitar = (url, opciones) => fetch(url, opciones), ...opciones } = {}) {
        super({...opciones,
            solicitar:(url, config) => solicitar(url, {...config, credentials:'include', cache:'no-store'})});
    }
    entrar(nombre, uuid) { return this.solicitarJson('sesion', {metodo:'POST', datos:{nombre, uuid}}); }
    recuperar() { return this.solicitarJson('sesion'); }
    cerrar() { return this.solicitarJson('sesion', {metodo:'DELETE'}); }
}
