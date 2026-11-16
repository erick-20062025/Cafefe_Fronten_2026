// Almacén exclusivamente de datos públicos, proyectados a una lista cerrada.
const PREFIJO='cafefe-catalogo-v1:';
function proyectar(datos,tipo) {
    if (!Array.isArray(datos)) throw new Error('Catálogo incompleto');
    const id=tipo==='categorias'?'idTipoProducto':'idProducto';
    return datos.map(d=>{
        if(!d || typeof d[id]!=='string' || !d[id] || typeof d.nombre!=='string' || typeof d.activo!=='boolean'
           || (tipo==='productos' && (typeof d.precioSugerido!=='number' || !Number.isFinite(d.precioSugerido) || d.precioSugerido<0))) throw new Error('Catálogo incompleto');
        const p={[id]:d[id],nombre:d.nombre,activo:d.activo};
        for(const campo of ['imagen','caracteristicas','comentarios']) if(typeof d[campo]==='string')p[campo]=d[campo];
        if(tipo==='productos')p.precioSugerido=d.precioSugerido;
        return p;
    }).filter(d=>d.activo);
}
export class CatalogoOffline {
    constructor({almacen=()=>globalThis.localStorage,conectado=()=>globalThis.navigator?.onLine!==false}={}) {
        this.almacen=almacen;this.conectado=conectado;this.pendientes=new Map();this.estados=new Map();this.version=0;
    }
    invalidar(){this.version++;this.pendientes.clear();}
    leer(clave,tipo){
        try {const d=JSON.parse(this.almacen()?.getItem(PREFIJO+clave));
            if(d?.version!==1 || !Number.isFinite(d.fecha))return null;
            return {datos:proyectar(d.datos,tipo),fecha:d.fecha};
        }catch{return null;}
    }
    respaldo(clave,tipo){
        const guardado=this.leer(clave,tipo);
        this.estados.set(clave,{guardado:true,fecha:guardado?.fecha,vacio:!guardado});
        return guardado?.datos || [];
    }
    consultar(clave,tipo,cargar){
        if(!this.conectado())return Promise.resolve(this.respaldo(clave,tipo));
        if(this.pendientes.has(clave))return this.pendientes.get(clave);
        const version=this.version;
        const tarea=(async()=>{
            try {
                const datos=await Promise.resolve().then(cargar);
                let publicos;try {publicos=proyectar(datos,tipo);}catch{return datos;}
                if(version===this.version){
                    const fecha=Date.now();
                    try {this.almacen()?.setItem(PREFIJO+clave,JSON.stringify({version:1,fecha,datos:publicos}));}catch{/* cuota o modo privado: online sigue disponible */}
                    this.estados.set(clave,{guardado:false,fecha,vacio:false});
                }
                return datos;
            }catch(error){
                if(version!==this.version)throw error;
                if(error.codigo!=="CONEXION" && !(error.estado>=500) && this.conectado())throw error;
                return this.respaldo(clave,tipo);
            }finally{if(this.pendientes.get(clave)===tarea)this.pendientes.delete(clave);}
        })();
        this.pendientes.set(clave,tarea);return tarea;
    }
    aviso(clave){const e=this.estados.get(clave);return !e?.guardado?'':e.vacio
        ? 'Sin conexión con el catálogo. Aún no hay datos guardados para esta sección; consúltala con conexión.'
        : 'Catálogo guardado. Precios orientativos; se actualizarán al recuperar conexión.';}
}
