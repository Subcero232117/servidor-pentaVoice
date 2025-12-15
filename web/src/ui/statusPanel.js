/* ======================================
   SUBVOICE - Status Panel Controller (MEJORADO)
   Control de estado de conexión visual
   ====================================== */

const connStatus = document.getElementById("connStatus");
const statusDot = connStatus?.querySelector('.status-dot');
const statusText = connStatus?.querySelector('.status-text');

let currentState = 'disconnected'; // 'connected', 'disconnected', 'connecting'

/* ==============================
   Actualizar UI de conexión
   ============================== */
function updateConnectionUI(state, message) {
    if (!connStatus) return;
    
    currentState = state;
    
    // Remover todas las clases de estado
    connStatus.classList.remove('connected', 'disconnected', 'connecting');
    
    // Añadir clase de estado actual
    connStatus.classList.add(state);
    
    // Actualizar texto
    if (statusText) {
        statusText.innerText = message;
    }
    
    console.log(`📡 Estado de conexión: ${state} - ${message}`);
}

/* ==============================
   Estados públicos
   ============================== */
export function setConnectedUI() {
    updateConnectionUI('connected', 'Conectado');
}

export function setDisconnectedUI() {
    updateConnectionUI('disconnected', 'Desconectado');
}

export function setConnectingUI() {
    updateConnectionUI('connecting', 'Conectando...');
}

export function setReconnectingUI(attempt, maxAttempts) {
    const message = `Reconectando (${attempt}/${maxAttempts})...`;
    updateConnectionUI('connecting', message);
}

export function setErrorUI(errorMessage) {
    updateConnectionUI('disconnected', errorMessage || 'Error de conexión');
}

export function getCurrentState() {
    return currentState;
}

/* ==============================
   Inicializar con estado de carga
   ============================== */
if (connStatus) {
    updateConnectionUI('connecting', 'Iniciando...');
}