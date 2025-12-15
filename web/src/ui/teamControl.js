/* ======================================
   SUBVOICE - Team Voice Controller (MEJORADO)
   Control de comunicación por equipos
   ====================================== */

import { emitTeamVState } from "../net/socketClient.js";
import { showNotification } from "../utils/notifications.js";

const btnTeamV = document.getElementById("btnTeamV");
const teamLabel = document.getElementById("teamLabel");
const teamStatus = document.getElementById("teamStatus");

let teamVEnabled = false; // Estado inicial (habla con todos)

/* ==============================
   Actualizar UI de Team Voice
   ============================== */
function updateTeamVUI(enabled) {
    if (!btnTeamV) return;
    
    // Cambiar clase del botón
    btnTeamV.classList.toggle('active', enabled);
    
    // Actualizar atributos ARIA
    btnTeamV.setAttribute('aria-pressed', enabled.toString());
    btnTeamV.setAttribute('aria-label', `Team Voice ${enabled ? 'activado' : 'desactivado'}`);
    
    // Actualizar label y status
    if (teamLabel) {
        teamLabel.innerText = "Team Voice";
    }
    
    if (teamStatus) {
        teamStatus.innerText = enabled ? "Activado" : "Desactivado";
        teamStatus.className = enabled ? "control-status active" : "control-status";
    }
    
    console.log(`👥 UI actualizado: Team Voice ${enabled ? 'ON' : 'OFF'}`);
}

/* ==============================
   Toggle de Team Voice
   ============================== */
function toggleTeamV() {
    teamVEnabled = !teamVEnabled;
    
    // Notificar al servidor
    emitTeamVState(teamVEnabled);
    
    // Actualizar UI
    updateTeamVUI(teamVEnabled);
    
    // Mostrar notificación descriptiva
    const message = teamVEnabled 
        ? 'Team Voice activado - Solo escucharás a tu equipo'
        : 'Team Voice desactivado - Escucharás a todos';
    
    showNotification(message, 'info');
}

/* ==============================
   Evento: Click al botón
   ============================== */
if (btnTeamV) {
    btnTeamV.addEventListener("click", toggleTeamV);
    
    // Configurar atributos iniciales
    btnTeamV.setAttribute('role', 'switch');
    btnTeamV.setAttribute('aria-label', 'Team Voice desactivado');
    
    // Estado inicial
    updateTeamVUI(teamVEnabled);
}

/* ==============================
   API para cambiar desde el servidor
   ============================== */
export function updateTeamV(enabled) {
    if (teamVEnabled === enabled) return; // Sin cambios
    
    teamVEnabled = enabled;
    updateTeamVUI(enabled);
    
    // Mostrar notificación si el servidor fuerza el cambio
    const message = enabled 
        ? 'El servidor activó Team Voice'
        : 'El servidor desactivó Team Voice';
    
    showNotification(message, 'warning');
}

export function setTeamVState(enabled) {
    if (teamVEnabled === enabled) return;
    
    teamVEnabled = enabled;
    emitTeamVState(enabled);
    updateTeamVUI(enabled);
}

export function getTeamVState() {
    return teamVEnabled;
}