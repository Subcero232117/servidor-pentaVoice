/* ============================================
   SUBVOICE - Peers Panel (MEJORADO)
   Gestión visual de jugadores conectados
   ============================================ */

import { emitName, getClientId, onPlayers, onDisconnect } from "../net/socketClient.js";
import { setPeerVolume, setPeerMuted, onPeerSpeaking } from "../net/rtcClient.js";
import { showNotification } from "../utils/notifications.js";

const peersList = document.getElementById("peersList");
const peersCount = document.getElementById("peersCount");
const peersEmpty = document.getElementById("peersEmpty");
const nameInput = document.getElementById("nameInput");
const btnSaveName = document.getElementById("btnSaveName");

const uiState = new Map(); // peerId -> { volume, muted, speaking }
let currentPeersList = {}; // Cache de la lista actual

/* ======== Helpers ======== */
function getOrInit(id) {
    if (!uiState.has(id)) {
        uiState.set(id, { 
            volume: 1, 
            muted: false, 
            speaking: false 
        });
    }
    return uiState.get(id);
}

function sanitizeName(name) {
    return name
        .trim()
        .replace(/[<>]/g, '')
        .substring(0, 24);
}

/* ======== Crear chip de equipo ======== */
function teamChip(team) {
    if (!team || team === "none" || team === "spectator") return null;
    
    const chip = document.createElement("span");
    chip.className = `team-chip team-${team}`;
    chip.innerText = team;
    chip.title = `Equipo: ${team}`;
    
    return chip;
}

/* ======== Crear card de peer ======== */
function createPeerCard(id, data) {
    const myId = getClientId();
    const isMe = id === myId;
    const state = getOrInit(id);
    
    // Detectar si está muteado por el servidor
    state.muted = state.muted || data.voiceMode === "mute";
    
    // Card principal
    const card = document.createElement("div");
    card.className = "peer-card";
    card.dataset.peer = id;
    if (isMe) card.classList.add("peer-card-me");
    
    // Badge de estado
    const badge = document.createElement("span");
    badge.className = "badge";
    if (state.muted) badge.classList.add("muted");
    if (state.speaking) badge.classList.add("speaking");
    
    // Header con nombre
    const header = document.createElement("div");
    header.className = "peer-header";
    header.appendChild(badge);
    
    const nameSpan = document.createElement("span");
    nameSpan.innerText = data.name || id;
    if (isMe) nameSpan.innerText += " (Tú)";
    header.appendChild(nameSpan);
    
    // Chip de equipo
    const chip = teamChip(data.team);
    if (chip) header.appendChild(chip);
    
    // Acciones (mute button)
    const actions = document.createElement("div");
    actions.className = "peer-actions";
    
    const muteBtn = document.createElement("button");
    muteBtn.className = "pill-btn";
    muteBtn.innerText = state.muted ? "Unmute" : "Mute";
    muteBtn.disabled = isMe;
    muteBtn.title = isMe ? "No puedes mutearte a ti mismo" : (state.muted ? "Desmutear" : "Mutear");
    
    muteBtn.addEventListener("click", () => {
        state.muted = !state.muted;
        setPeerMuted(id, state.muted);
        muteBtn.innerText = state.muted ? "Unmute" : "Mute";
        badge.classList.toggle("muted", state.muted);
        
        showNotification(
            `${data.name || id} ${state.muted ? 'muteado' : 'desmuteado'}`,
            'info'
        );
    });
    
    actions.appendChild(muteBtn);
    
    // Volumen individual
    const volumeRow = document.createElement("div");
    volumeRow.className = "peer-volume";
    
    const volLabel = document.createElement("span");
    volLabel.innerText = "Vol.";
    
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = Math.round((state.volume ?? 1) * 100);
    slider.disabled = isMe;
    slider.title = isMe ? "Tu propio volumen" : "Ajustar volumen de este jugador";
    
    // Debounce para el slider
    let volumeTimeout;
    slider.addEventListener("input", (e) => {
        const v = Number(e.target.value) / 100;
        state.volume = v;
        
        clearTimeout(volumeTimeout);
        volumeTimeout = setTimeout(() => {
            setPeerVolume(id, v);
        }, 50);
    });
    
    volumeRow.appendChild(volLabel);
    volumeRow.appendChild(slider);
    
    // Ensamblar card
    card.appendChild(header);
    card.appendChild(actions);
    card.appendChild(volumeRow);
    
    return card;
}

/* ======== Actualizar solo los estados sin re-renderizar ======== */
function updatePeerStates(entries) {
    entries.forEach(([id, data]) => {
        const card = peersList.querySelector(`[data-peer="${id}"]`);
        if (!card) return;
        
        const state = getOrInit(id);
        const badge = card.querySelector('.badge');
        const muteBtn = card.querySelector('.pill-btn');
        const nameSpan = card.querySelector('.peer-header span:nth-child(2)');
        
        // Actualizar nombre si cambió
        const myId = getClientId();
        const isMe = id === myId;
        const displayName = data.name || id;
        if (nameSpan && nameSpan.innerText !== displayName + (isMe ? " (Tú)" : "")) {
            nameSpan.innerText = displayName + (isMe ? " (Tú)" : "");
        }
        
        // Actualizar badge
        if (badge) {
            badge.classList.toggle("muted", state.muted);
            badge.classList.toggle("speaking", state.speaking);
        }
        
        // Actualizar botón de mute
        if (muteBtn) {
            muteBtn.innerText = state.muted ? "Unmute" : "Mute";
        }
    });
}

/* ======== Comparar si dos sets son iguales ======== */
function setsAreEqual(set1, set2) {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
        if (!set2.has(item)) return false;
    }
    return true;
}

/* ======== Actualizar lista completa de peers ======== */
export function updatePeersList(rawList) {
    if (!rawList || typeof rawList !== 'object') return;
    
    const entries = Object.entries(rawList);
    const newCount = entries.length;
    
    // Actualizar contador
    if (peersCount) {
        peersCount.innerText = newCount;
    }
    
    // Mostrar/ocultar estado vacío
    if (peersEmpty) {
        peersEmpty.style.display = newCount === 0 ? 'flex' : 'none';
    }
    
    // Obtener IDs actuales y nuevos
    const currentIds = new Set(Object.keys(currentPeersList));
    const newIds = new Set(entries.map(([id]) => id));
    
    // Si los IDs son iguales, solo actualizar estados
    if (setsAreEqual(currentIds, newIds)) {
        updatePeerStates(entries);
        currentPeersList = rawList;
        return;
    }
    
    // Hay cambios en la lista, re-renderizar
    console.log(`👥 Actualizando lista de peers: ${newCount} jugador(es)`);
    
    // Usar DocumentFragment para mejor rendimiento
    const fragment = document.createDocumentFragment();
    
    entries.forEach(([id, data]) => {
        fragment.appendChild(createPeerCard(id, data));
    });
    
    // Limpiar y actualizar
    peersList.innerHTML = "";
    peersList.appendChild(fragment);
    
    currentPeersList = rawList;
}

/* ======== Callback cuando alguien habla ======== */
onPeerSpeaking((peerId, speaking) => {
    const state = getOrInit(peerId);
    state.speaking = speaking;
    
    const badge = peersList.querySelector(`[data-peer="${peerId}"] .badge`);
    if (badge) {
        badge.classList.toggle("speaking", speaking);
    }
});

/* ======== Inicializar UI de peers ======== */
export function initPeersUI() {
    // Cargar nombre guardado
    const savedName = localStorage.getItem("subvoice_name");
    if (savedName && nameInput) {
        nameInput.value = savedName;
        emitName(savedName);
        console.log(`✅ Nombre cargado: ${savedName}`);
    }

    // Evento para guardar nombre
    if (btnSaveName && nameInput) {
        btnSaveName.addEventListener("click", handleSaveName);
        
        // También guardar al presionar Enter
        nameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                handleSaveName();
            }
        });
    }

    // Suscripciones a eventos del socket
    onPlayers(updatePeersList);
    onDisconnect(clearPeersState);
    
    console.log("✅ Peers UI inicializado");
}

/* ======== Manejar guardado de nombre ======== */
function handleSaveName() {
    if (!nameInput) return;
    
    const rawName = nameInput.value.trim();
    
    if (!rawName) {
        showNotification('Por favor ingresa un nombre válido', 'warning');
        return;
    }
    
    const name = sanitizeName(rawName);
    
    // Guardar en localStorage
    localStorage.setItem("subvoice_name", name);
    
    // Enviar al servidor
    emitName(name);
    
    // Feedback visual
    showNotification(`Nombre guardado: ${name}`, 'success');
    nameInput.value = name; // Actualizar con nombre sanitizado
    
    console.log(`✅ Nombre guardado y enviado: ${name}`);
}

/* ======== API para obtener estado de un peer ======== */
export function getPeerState(peerId) {
    return uiState.get(peerId) || null;
}

/* ======== API para obtener todos los peers ======== */
export function getAllPeers() {
    return currentPeersList;
}

/* ======== Limpiar estado al desconectar ======== */
export function clearPeersState() {
    uiState.clear();
    currentPeersList = {};
    if (peersList) {
        peersList.innerHTML = "";
    }
    if (peersCount) {
        peersCount.innerText = "0";
    }
    if (peersEmpty) {
        peersEmpty.style.display = 'flex';
    }
    console.log("🧹 Estado de peers limpiado");
}
