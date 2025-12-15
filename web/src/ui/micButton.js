/* ======================================
   SUBVOICE - UI Mic Controller (MEJORADO)
   ====================================== */

import { setMicState } from "../net/rtcClient.js";
import { emitMicState } from "../net/socketClient.js";
import { showNotification } from "../utils/notifications.js";

const btnMic = document.getElementById("btnMic");
const micLabel = document.getElementById("micLabel");
const micStatus = document.getElementById("micStatus");

let micActive = true; // Estado inicial

/* ==============================
   Actualizar UI del micrófono
   ============================== */
function updateMicUI(active) {
    if (!btnMic) return;
    
    // Cambiar clase del botón
    btnMic.classList.toggle('active', active);
    
    // Actualizar atributos ARIA
    btnMic.setAttribute('aria-pressed', active.toString());
    btnMic.setAttribute('aria-label', `Micrófono ${active ? 'activado' : 'desactivado'}`);
    
    // Actualizar label y status
    if (micLabel) {
        micLabel.innerText = "Micrófono";
    }
    
    if (micStatus) {
        micStatus.innerText = active ? "Activo" : "Desactivado";
        micStatus.className = active ? "control-status active" : "control-status";
    }
    
    console.log(`🎤 UI actualizado: Micrófono ${active ? 'ON' : 'OFF'}`);
}

/* ==============================
   Toggle del micrófono
   ============================== */
function toggleMic() {
    micActive = !micActive;
    
    // Actualizar estado real del track
    setMicState(micActive);
    
    // Notificar al servidor
    emitMicState(micActive);
    
    // Actualizar UI
    updateMicUI(micActive);
    
    // Mostrar notificación
    showNotification(
        `Micrófono ${micActive ? 'activado' : 'desactivado'}`,
        micActive ? 'success' : 'info'
    );
}

/* ==============================
   Evento: Click al botón del mic
   ============================== */
if (btnMic) {
    btnMic.addEventListener("click", toggleMic);
    
    // Configurar atributos iniciales
    btnMic.setAttribute('role', 'switch');
    btnMic.setAttribute('aria-label', 'Micrófono activado');
    
    // Estado inicial
    updateMicUI(micActive);
}

/* ==============================
   API para cambiar estado externamente
   ============================== */
export function setMicActive(state) {
    if (micActive === state) return; // Sin cambios
    
    micActive = state;
    setMicState(micActive);
    emitMicState(micActive);
    updateMicUI(micActive);
}

export function getMicState() {
    return micActive;
}

/* ==============================
   Detectar cambios en permisos
   ============================== */
if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'microphone' })
        .then(permissionStatus => {
            console.log(`🎤 Permiso de micrófono: ${permissionStatus.state}`);
            
            permissionStatus.onchange = () => {
                console.log(`🎤 Permiso de micrófono cambió a: ${permissionStatus.state}`);
                
                if (permissionStatus.state === 'denied') {
                    showNotification(
                        'Permiso de micrófono denegado. Por favor, permite el acceso en la configuración del navegador.',
                        'error'
                    );
                    setMicActive(false);
                } else if (permissionStatus.state === 'granted' && !micActive) {
                    showNotification(
                        'Permiso de micrófono concedido. Puedes activar el micrófono.',
                        'success'
                    );
                }
            };
        })
        .catch(err => {
            console.warn('⚠️ No se pudo consultar permisos:', err);
        });
}