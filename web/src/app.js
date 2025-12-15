/* =====================================================
   SUBVOICE - APP CORE (MEJORADO)
   Inicializa controles, WebRTC, sockets y eventos UI.
   ===================================================== */

import { initMic, setVolume } from "./net/rtcClient.js";
import { emitVolume } from "./net/socketClient.js";
import "./ui/micButton.js";
import "./ui/teamControl.js";
import "./ui/statusPanel.js";
import { initVolumeBar } from "./utils/volumeBar.js";
import { initPeersUI } from "./ui/peersPanel.js";
import { showNotification } from "./utils/notifications.js";

/* ============================
   ESTADO DE LA APLICACIÓN
   ============================ */
const appState = {
    initialized: false,
    loading: true,
    errors: []
};

/* ============================
   MANEJO DE ERRORES GLOBAL
   ============================ */
window.addEventListener('error', (e) => {
    console.error('❌ Error no manejado:', e.error);
    appState.errors.push({
        message: e.error?.message || 'Error desconocido',
        timestamp: Date.now()
    });
    
    if (appState.errors.length > 3) {
        showNotification('Se han detectado múltiples errores. Por favor, recarga la página.', 'error');
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ Promesa rechazada:', e.reason);
    showNotification('Error de conexión detectado', 'warning');
});

/* ============================
   LOADING STATE
   ============================ */
function showLoadingState() {
    document.body.classList.add('loading');
}

function hideLoadingState() {
    document.body.classList.remove('loading');
    appState.loading = false;
}

/* ============================
   VOLUMEN GLOBAL DEL SISTEMA
   ============================ */
const volSlider = document.getElementById("volSlider");
const volumeValue = document.getElementById("volumeValue");

initVolumeBar(volSlider, (v) => {
    setVolume(v);
    emitVolume(v);
    if (volumeValue) {
        volumeValue.innerText = `${Math.round(v * 100)}%`;
    }
});

/* ============================
   HOTKEYS (ATAJOS DE TECLADO)
   ============================ */
function setupHotkeys() {
    document.addEventListener('keydown', (e) => {
        // Ignorar si está escribiendo en un input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        // Ctrl/Cmd + M = Toggle Micrófono
        if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
            e.preventDefault();
            document.getElementById('btnMic')?.click();
            showNotification('Micrófono alternado', 'info');
        }

        // Ctrl/Cmd + T = Toggle Team Voice
        if ((e.ctrlKey || e.metaKey) && e.key === 't') {
            e.preventDefault();
            document.getElementById('btnTeamV')?.click();
            showNotification('Team Voice alternado', 'info');
        }

        // Ctrl/Cmd + I = Mostrar info de debug
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
            e.preventDefault();
            console.log('📊 Estado de la aplicación:', appState);
        }
    });

    console.log('⌨️ Hotkeys configurados:');
    console.log('  Ctrl+M: Toggle Micrófono');
    console.log('  Ctrl+T: Toggle Team Voice');
    console.log('  Ctrl+I: Debug Info');
}

/* ============================
   INICIALIZACIÓN GLOBAL
   ============================ */
async function boot() {
    console.log("%c🎙️ SubVoice Init...", "color:#d4b896;font-size:16px;font-weight:bold;");
    showLoadingState();

    try {
        // 1. Inicializar UI de peers
        initPeersUI();
        console.log("✅ Peers UI inicializado");

        // 2. Configurar hotkeys
        setupHotkeys();
        console.log("✅ Hotkeys configurados");

        // 3. Activar micrófono (puede fallar si no hay permiso)
        try {
            await initMic();
            console.log("✅ Micrófono inicializado");
            showNotification('Micrófono activado correctamente', 'success');
        } catch (micError) {
            console.error("⚠️ Error al inicializar micrófono:", micError);
            showNotification('No se pudo acceder al micrófono. Verifica los permisos.', 'error');
        }

        // 4. Configurar volumen inicial
const savedVolume = localStorage.getItem('subvoice_volume');
const initialVolume = savedVolume ? parseFloat(savedVolume) : 0.8;

setVolume(initialVolume);
emitVolume(initialVolume);
volSlider.value = Math.round(initialVolume * 100);
        if (volumeValue) {
            volumeValue.innerText = `${Math.round(initialVolume * 100)}%`;
        }

        console.log("✅ Volumen configurado:", Math.round(initialVolume * 100) + "%");

        // 5. Marcar como inicializado
        appState.initialized = true;
        hideLoadingState();

        console.log("%c🔥 SubVoice Ready", "color:#7fb069;font-size:16px;font-weight:bold;");
        
        // Mostrar mensaje de bienvenida después de 500ms
        setTimeout(() => {
            showNotification('SubVoice conectado y listo', 'success');
        }, 500);

    } catch (error) {
        console.error("❌ Error crítico durante la inicialización:", error);
        hideLoadingState();
        showNotification('Error al inicializar SubVoice. Por favor, recarga la página.', 'error');
        appState.errors.push({
            message: 'Error crítico de inicialización',
            error: error.message,
            timestamp: Date.now()
        });
    }
}

/* ============================
   GUARDAR VOLUMEN AL CAMBIAR
   ============================ */
volSlider?.addEventListener('change', () => {
    const volume = Number(volSlider.value) / 100;
    localStorage.setItem('subvoice_volume', volume.toString());
});

/* ============================
   DETECCIÓN DE VISIBILIDAD
   ============================ */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('👋 Página oculta - pausando actualizaciones innecesarias');
    } else {
        console.log('👀 Página visible - reanudando operación normal');
    }
});

/* ============================
   EJECUCIÓN AL CARGAR DOM
   ============================ */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}

/* ============================
   EXPORTS PARA DEBUG
   ============================ */
if (import.meta.env?.DEV || window.location.hostname === 'localhost') {
    window.__SUBVOICE_DEBUG__ = {
        state: appState,
        version: '2.0.0',
        build: 'penta-studio'
    };
    console.log('🔧 Modo debug activo - usa window.__SUBVOICE_DEBUG__');
}
