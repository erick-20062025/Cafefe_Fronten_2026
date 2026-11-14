export async function registrarPwa(boton, estado) {
    let solicitud;
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); solicitud = event; boton.hidden = false; });
    window.addEventListener('appinstalled', () => { solicitud = null; boton.hidden = true; estado.textContent = 'Aplicación instalada.'; });
    boton.onclick = async () => {
        if (!solicitud) return;
        await solicitud.prompt(); await solicitud.userChoice;
        solicitud = null; boton.hidden = true;
    };
    if (!('serviceWorker' in navigator)) { estado.textContent = 'Este navegador no admite el modo sin conexión.'; return; }
    try {
        await navigator.serviceWorker.register(new URL('../../sw.js', import.meta.url), { scope: new URL('../../', import.meta.url).pathname });
    } catch { estado.textContent = 'No se pudo habilitar el modo sin conexión. Usa localhost o HTTPS.'; }
}
