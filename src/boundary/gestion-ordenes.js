export class GestionOrdenes extends HTMLElement {
    connectedCallback(){this.version=0;this.actualizar();}
    disconnectedCallback(){this.version++;}
    async actualizar(){
        const version=++this.version;this.replaceChildren();
        const titulo=document.createElement('h2');titulo.textContent='Gestión de mis órdenes';
        const estado=document.createElement('p');estado.setAttribute('role','status');estado.textContent='Consultando órdenes…';this.append(titulo,estado);
        try {
            const ordenes=await this.servicio.solicitarJson('ordenes/gestionables');if(version!==this.version)return;
            estado.textContent=ordenes.length?'Solo puedes cancelar órdenes pendientes, sin factura.':'No hay órdenes para gestionar.';
            for(const orden of ordenes){
                const fila=document.createElement('article');fila.className='tarjeta';
                const nombre=document.createElement('p');nombre.textContent=`${orden.idOrden.slice(0,8)} · ${orden.cliente || 'Cliente'} · ${orden.estadoPreparacion || 'PENDIENTE'}`;fila.append(nombre);
                if(orden.estadoPreparacion==='PENDIENTE'){
                    const boton=document.createElement('button');boton.textContent='Cancelar orden';
                    boton.onclick=async()=>{
                        if(navigator.onLine===false){estado.textContent='La cancelación requiere conexión.';return;}
                        if(!window.confirm('¿Cancelar esta orden? Su historial se conservará.'))return;
                        boton.disabled=true;
                        try {await this.servicio.solicitarJson(`ordenes/${orden.idOrden}/cancelacion`,{metodo:'POST'});await this.actualizar();this.querySelector('[role=status]').textContent='Orden cancelada. El historial se conserva.';}
                        catch(error){estado.textContent=error.message;boton.disabled=false;}
                    };fila.append(boton);
                }this.append(fila);
            }
        }catch(error){if(error.estado===401)this.dispatchEvent(new CustomEvent("sesion-vencida",{bubbles:true}));else if(version===this.version)estado.textContent=error.message;}
    }
}
customElements.define('cafefe-gestion-ordenes',GestionOrdenes);
