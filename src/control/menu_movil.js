export function conectarMenu(raiz) {
    const boton=raiz.querySelector('.menu-alternar'), panel=raiz.querySelector('.barra-lateral');
    const cerrar=raiz.querySelector('.menu-cerrar');
    const cambiar=abierto=>{raiz.classList.toggle('menu-abierto',abierto);boton.setAttribute('aria-expanded',String(abierto));};
    boton.onclick=()=>cambiar(boton.getAttribute('aria-expanded')!=='true');
    cerrar.onclick=()=>{cambiar(false);boton.focus();};
    const navegar=e=>{if(e.target.closest('a, .sesion-control'))cambiar(false);};
    const teclado=e=>{if(e.key==='Escape'){cambiar(false);boton.focus();}};
    panel.addEventListener('click',navegar);raiz.addEventListener('keydown',teclado);
    return ()=>{panel.removeEventListener('click',navegar);raiz.removeEventListener('keydown',teclado);};
}
