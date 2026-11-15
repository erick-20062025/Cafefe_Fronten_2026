import '../../src/boundary/recepcion-view.js';
import DefaultError from '../../src/entity/default_error.js';
const selector = document.querySelector('#escenario');
function mostrar() {
    const escenario = selector.value;
    const vista = document.createElement('cafefe-recepcion');
    vista.servicio = {
        async pendientes() {
            if (escenario === 'error') throw new DefaultError('Error simulado al consultar las órdenes.', {estado:503});
            return escenario === 'vacio' ? [] : [
                {idOrden:'00000000-0000-0000-0000-000000000001',fechaCreacion:'2026-11-14T14:30:00Z'},
                {idOrden:'00000000-0000-0000-0000-000000000002',fechaCreacion:'2026-11-14T14:35:00Z'}];
        },
        async productos(id) {
            return id.endsWith('1') ? [{producto:'Café de prueba',precio:2.5,observaciones:'Sin azúcar — dato ficticio'}] :
                [{producto:'Pan de prueba',precio:1.25,observaciones:'Para llevar — dato ficticio'}];
        }
    };
    document.querySelector('#vista').replaceChildren(vista);
}
selector.addEventListener('change',mostrar); mostrar();
