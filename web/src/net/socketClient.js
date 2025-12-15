/* ============================================
   SUBVOICE - WebSocket Client (MEJORADO)
   Manejo de conexión con el servidor Node
   ============================================ */

import { setConnectedUI, setDisconnectedUI, setConnectingUI } from "../ui/statusPanel.js";
import { updateTeamV } from "../ui/teamControl.js";
import { createPingSmoother } from "../utils/ping.js";
import { showNotification } from "../utils/notifications.js";

let socket = null;
let connected = false;
let roomId = null;
let clientId = `cli_${Math.random().toString(36).slice(2, 10)}`;

let signalHandler = null;
let nameToSend = null;
let playerHandlers = [];
let disconnectHandlers = [];

/* ======== Estado de reconexión ======== */
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 2000; // 2 segundos
let reconnectTimeout = null;
let intentionalDisconnect = false;

/* ======== Heartbeat mejorado ======== */
let pingInterval = null;
let lastPongTime = Date.now();
const PING_TIMEOUT = 10000; // 10 segundos
const PING_INTERVAL = 3000; // 3 segundos

/* ======== UI Elements ======== */
const pingLabel  = document.getElementById("ping");
const roomLabel  = document.getElementById("room");
const pingSmoother = createPingSmoother();

/* ======== Rate Limiter ======== */
const rateLimiter = {
    lastSent: {},
    
    canSend(type, minInterval = 100) {
        const now = Date.now();
        const last = this.lastSent[type] || 0;
        
        if (now - last < minInterval) {
            return false;
        }
        
        this.lastSent[type] = now;
        return true;
    }
};

/* ======== Conectar al servidor CON RECONEXIÓN AUTOMÁTICA ======== */
function connectToServer() {
    setConnectingUI();
    if (intentionalDisconnect) {
        console.log('🛑 Desconexión intencional, no reconectando');
        return;
    }
    
    const host = window.location.hostname && window.location.hostname !== "" ? window.location.hostname : "127.0.0.1";
    const port = window.location.port && window.location.port !== "" ? window.location.port : "8000";
    const HOST = `${host}:${port}`;
    
    // Limpiar timeout previo
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    
    console.log(`🔌 Conectando a ws://${HOST} (intento ${reconnectAttempts + 1})...`);
    
    try {
        socket = new WebSocket(`ws://${HOST}`);
    } catch (err) {
        console.error('❌ Error creando WebSocket:', err);
        scheduleReconnect();
        return;
    }

    socket.onopen = () => {
        console.log('✅ WebSocket conectado');
        connected = true;
        reconnectAttempts = 0;
        setConnectedUI();
        
        // Enviar hello
        socket.send(JSON.stringify({
            type: "hello_web",
            clientId
        }));

        // Enviar nombre si está pendiente
        if (nameToSend) {
            emitName(nameToSend);
        }
        
        // Iniciar heartbeat
        startHeartbeat();
        
        showNotification('Conectado al servidor', 'success');
    };

    socket.onclose = (event) => {
        console.log(`🔌 WebSocket cerrado (code: ${event.code}, reason: ${event.reason})`);
        handleDisconnection();
    };

    socket.onerror = (error) => {
        console.error('❌ Error en WebSocket:', error);
    };

    socket.onmessage = ({ data }) => {
        try {
            const msg = JSON.parse(data);
            handleServer(msg);
        } catch (err) {
            console.error('❌ Error parseando mensaje:', err);
        }
    };
}

/* ======== Manejo de desconexión ======== */
function handleDisconnection() {
    connected = false;
    setDisconnectedUI();
    stopHeartbeat();
    disconnectHandlers.forEach(fn => {
        try { fn(); } catch (e) { console.error(e); }
    });
    
    pingSmoother.reset();
    if (pingLabel) {
        pingLabel.innerText = "Ping: -- ms";
    }
    
    if (!intentionalDisconnect) {
        scheduleReconnect();
    }
}

/* ======== Programar reconexión con backoff exponencial ======== */
function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('❌ Máximo de intentos de reconexión alcanzado');
        showNotification('No se pudo conectar al servidor. Por favor, recarga la página.', 'error');
        return;
    }
    
    const delay = Math.min(
        BASE_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts),
        30000 // Máximo 30 segundos
    );
    
    reconnectAttempts++;
    
    console.log(`⏳ Reconectando en ${Math.round(delay/1000)}s...`);
    showNotification(`Reconectando en ${Math.round(delay/1000)}s...`, 'warning');
    
    reconnectTimeout = setTimeout(connectToServer, delay);
}

/* ======== Heartbeat (ping/pong) ======== */
function startHeartbeat() {
    stopHeartbeat(); // Limpiar cualquier intervalo previo
    
    lastPongTime = Date.now();
    
    pingInterval = setInterval(() => {
        const now = Date.now();
        
        // Verificar si no hemos recibido pong
        if (now - lastPongTime > PING_TIMEOUT) {
            console.warn('⚠️ Ping timeout - conexión perdida');
            socket?.close();
            return;
        }
        
        // Enviar ping
        if (connected && socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ 
                type: 'ping', 
                timestamp: now 
            }));
        }
    }, PING_INTERVAL);
}

function stopHeartbeat() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
}

/* ======== Manejo de mensajes ======== */
function handleServer(msg) {
    switch (msg.type) {
        case "room":
            roomId = msg.value;
            if (roomLabel) {
                roomLabel.innerText = `Room: ${roomId}`;
            }
            console.log(`🏠 Asignado a room: ${roomId}`);
            break;

        case "ping":
            // Respuesta del servidor con latencia
            const latency = pingSmoother(msg.value);
            lastPongTime = Date.now();
            if (pingLabel) {
                pingLabel.innerText = `Ping: ${latency} ms`;
            }
            break;

        case "pong":
            // Respuesta a nuestro ping
            lastPongTime = Date.now();
            const rtt = lastPongTime - msg.timestamp;
            const smoothedPing = pingSmoother(rtt);
            if (pingLabel) {
                pingLabel.innerText = `Ping: ${smoothedPing} ms`;
            }
            break;

        case "teamv":
            updateTeamV(msg.enabled);
            break;

        case "players":
            playerHandlers.forEach(fn => {
                try { fn(msg.list); } catch (e) { console.error(e); }
            });
            break;

        case "signal":
            if (signalHandler) {
                signalHandler(msg);
            }
            break;

        case "error":
            console.error('❌ Error del servidor:', msg.message);
            showNotification(msg.message || 'Error del servidor', 'error');
            break;

        case "notification":
            showNotification(msg.message, msg.level || 'info');
            break;

        default:
            console.log('📨 Mensaje no manejado:', msg.type);
    }
}

/* ======== Emitir comandos básicos CON RATE LIMITING ======== */
function sendMessage(message) {
    if (!connected || !socket || socket.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ No se puede enviar mensaje - no conectado');
        return false;
    }
    
    try {
        socket.send(JSON.stringify(message));
        return true;
    } catch (err) {
        console.error('❌ Error enviando mensaje:', err);
        return false;
    }
}

export function emitMicState(state) {
    if (!rateLimiter.canSend('mic', 200)) return;
    
    sendMessage({
        type: "mic",
        clientId,
        state
    });
}

export function emitTeamVState(enabled) {
    if (!rateLimiter.canSend('teamv', 200)) return;
    
    sendMessage({
        type: "teamv",
        clientId,
        enabled
    });
}

export function emitVolume(vol) {
    if (!rateLimiter.canSend('volume', 100)) return;
    
    sendMessage({
        type: "volume",
        clientId,
        value: vol
    });
}

export function emitName(name) {
    nameToSend = name;
    
    if (!rateLimiter.canSend('name', 1000)) return;
    
    const sanitized = sanitizeUsername(name);
    
    sendMessage({
        type: "set_name",
        name: sanitized
    });
}

/* ======== WebRTC signaling ======== */
export function sendSignal(to, action, payload) {
    if (!rateLimiter.canSend(`signal_${to}_${action}`, 50)) return;
    
    sendMessage({
        type: "signal",
        from: clientId,
        to,
        action,
        payload
    });
}

export function onSignal(handler) {
    signalHandler = handler;
}

/* ======== Helpers ======== */
export function getRoomId() {
    return roomId;
}

export function getClientId() {
    return clientId;
}

export function onPlayers(handler) {
    if (typeof handler === "function") {
        playerHandlers.push(handler);
    }
}

export function onDisconnect(handler) {
    if (typeof handler === "function") {
        disconnectHandlers.push(handler);
    }
}

export function isConnected() {
    return connected && socket?.readyState === WebSocket.OPEN;
}

export function disconnect() {
    console.log('🛑 Desconexión manual solicitada');
    intentionalDisconnect = true;
    stopHeartbeat();
    
    if (socket) {
        socket.close(1000, 'Manual disconnect');
    }
}

export function reconnect() {
    console.log('🔄 Reconexión manual solicitada');
    intentionalDisconnect = false;
    reconnectAttempts = 0;
    
    if (socket) {
        socket.close();
    }
    
    connectToServer();
}

/* ======== Sanitización de nombre de usuario ======== */
function sanitizeUsername(name) {
    return name
        .trim()
        .replace(/[<>]/g, '') // Prevenir XSS básico
        .substring(0, 24);    // Límite de caracteres
}

/* ======== Detección de cambio de red ======== */
if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    navigator.connection?.addEventListener('change', () => {
        console.log('🌐 Cambio de red detectado');
        if (connected) {
            showNotification('Red cambiada, reconectando...', 'info');
            reconnect();
        }
    });
}

/* ======== Online/Offline detection ======== */
window.addEventListener('online', () => {
    console.log('🌐 Conexión a internet restaurada');
    if (!connected) {
        showNotification('Conexión restaurada, reconectando...', 'success');
        reconnect();
    }
});

window.addEventListener('offline', () => {
    console.log('🌐 Conexión a internet perdida');
    showNotification('Sin conexión a internet', 'error');
});

/* ======== Iniciar conexión al cargar ======== */
connectToServer();

/* ======== Cleanup al cerrar página ======== */
window.addEventListener('beforeunload', () => {
    disconnect();
});
