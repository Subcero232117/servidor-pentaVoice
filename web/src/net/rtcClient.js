/* ============================================
   SUBVOICE - WebRTC Client
   Manejo de audio P2P usando signaling por WS
   ============================================ */

import { sendSignal, onSignal, getClientId, onPlayers } from "./socketClient.js";

let localStream = null;
let peers = new Map(); // peerId -> RTCPeerConnection
let peerMeta = new Map(); // peerId -> { polite, makingOffer, ignoreOffer }
let micReady = false;
let pendingList = null;

let globalVolume = 1;
const peerState = new Map(); // id -> { volume, muted, speaking, audio }
let speakingCb = null;

let analysisCtx = null;

/* ========== Config de STUN (puedes cambiarlo) ========== */
const RTC_CONFIG = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};

const defaultPeerState = () => ({
    volume: 1,
    muted: false,
    speaking: false,
    audio: null
});

/* ========== Inicializar micrófono ========== */
export async function initMic() {
    if (localStream) return;

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 48000,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: false
            },
            video: false
        });
        setupSignalListener();
        console.log("✅ Mic capturando audio...");
        micReady = true;
        if (pendingList) {
            connectToList(pendingList);
            pendingList = null;
        }
    } catch (err) {
        console.error("Error al obtener micrófono:", err);
    }
}

/* ========== Volumen global de remotos ========== */
export function setVolume(v) {
    globalVolume = Math.min(1, Math.max(0, v));
    peerState.forEach((state, id) => applyVolume(id, state));
}

function applyVolume(id, state) {
    const audio = state.audio;
    if (!audio) return;
    const finalVolume = globalVolume * (state.volume ?? 1);
    audio.volume = finalVolume;
    audio.muted = !!state.muted;
}

/* ========== Crear PeerConnection ========== */
function createPeer(peerId, isCaller) {
    if (peers.has(peerId)) return peers.get(peerId);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const polite = getClientId().localeCompare(peerId) > 0;
    peerMeta.set(peerId, { polite, makingOffer: false, ignoreOffer: false });

    // Enviamos nuestro audio (solo captura, sin monitoreo local)
    if (localStream) {
        for (const track of localStream.getAudioTracks()) {
            const sender = pc.addTrack(track, localStream);
            tuneAudioSender(sender);
        }
    }

    // Recibimos audio del otro
    pc.ontrack = evt => {
        const [remoteStream] = evt.streams;
        attachRemoteAudio(peerId, remoteStream);
    };

    // ICE candidates
    pc.onicecandidate = evt => {
        if (evt.candidate) {
            sendSignal(peerId, "ice", evt.candidate);
        }
    };

    // Si somos caller, creamos offer
    if (isCaller) {
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .then(() => {
              sendSignal(peerId, "offer", pc.localDescription);
          })
          .catch(console.error);
    }

    peers.set(peerId, pc);
    return pc;
}

function closePeer(peerId) {
    const pc = peers.get(peerId);
    if (pc) {
        pc.close();
        peers.delete(peerId);
    }
    peerMeta.delete(peerId);
    const state = peerState.get(peerId);
    if (state?.audio) {
        state.audio.srcObject = null;
        state.audio.remove();
    }
    peerState.delete(peerId);
}

function connectToList(list) {
    if (!micReady) {
        pendingList = list;
        return;
    }

    const entries = Object.keys(list || {});
    const myId = getClientId();

    // Crear offers hacia nuevos peers (lexicográficamente menor inicia)
    entries.forEach(id => {
        if (id === myId) return;
        if (!peers.has(id)) {
            const pc = createPeer(id, true);
            if (myId.localeCompare(id) < 0) {
                negotiate(id, pc);
            }
        }
    });

    // Cerrar conexiones que ya no están
    Array.from(peers.keys()).forEach(id => {
        if (!entries.includes(id)) {
            closePeer(id);
        }
    });
}

/* ========== Adjuntar audio remoto al DOM ========== */
function attachRemoteAudio(peerId, stream) {
    let state = peerState.get(peerId);
    if (!state) {
        state = defaultPeerState();
        peerState.set(peerId, state);
    }

    let audio = document.getElementById(`remote_${peerId}`);
    if (!audio) {
        audio = document.createElement("audio");
        audio.id = `remote_${peerId}`;
        audio.autoplay = true;
        audio.playsInline = true;
        audio.style.display = "none";
        document.body.appendChild(audio);
    }
    audio.srcObject = stream;
    state.audio = audio;
    applyVolume(peerId, state);
    monitorSpeaking(peerId, stream, state);
    audio.play().catch(() => {});
}

function tuneAudioSender(sender) {
    if (!sender?.getParameters) return;
    const params = sender.getParameters();
    params.encodings = params.encodings || [{}];
    params.encodings[0].maxBitrate = 192000; // ~192 kbps Opus para mayor fidelidad
    params.encodings[0].ptime = 10; // paquetes más frecuentes
    params.encodings[0].dtx = false; // evita cortes por detección de silencio agresiva
    params.encodings[0].priority = "high";
    params.encodings[0].networkPriority = "high";
    sender.setParameters(params).catch(() => {});
}

async function negotiate(peerId, pc) {
    const meta = peerMeta.get(peerId);
    if (!pc || !meta || meta.makingOffer) return;
    try {
        meta.makingOffer = true;
        await pc.setLocalDescription(await pc.createOffer());
        sendSignal(peerId, "offer", pc.localDescription);
    } catch (err) {
        console.error("Error creando offer:", err);
    } finally {
        meta.makingOffer = false;
    }
}

function monitorSpeaking(peerId, stream, state) {
    if (!analysisCtx) {
        analysisCtx = new AudioContext();
    }
    const source = analysisCtx.createMediaStreamSource(stream);
    const analyser = analysisCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    const threshold = 8; // 0-255 escala: sensibilidad
    const decayMs = 300;
    let lastHigh = 0;

    const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const v = data[i] - 128;
            sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const now = performance.now();

        const speakingNow = rms > threshold || (now - lastHigh < decayMs);
        if (rms > threshold) lastHigh = now;

        if (state.speaking !== speakingNow) {
            state.speaking = speakingNow;
            speakingCb?.(peerId, speakingNow);
        }
        requestAnimationFrame(loop);
    };
    loop();
}

/* ========== Recibir señales desde el server ========== */
function setupSignalListener() {
    onSignal(async msg => {
        const myId = getClientId();
        const { from, action, payload } = msg;

        // Ignorar mensajes que vienen de mí mismo
        if (from === myId) return;

        let pc = peers.get(from);
        const meta = peerMeta.get(from);
        if (!meta && action !== "offer") {
            pc = createPeer(from, false);
        }

        // Si recibo offer y no tengo peer => soy callee
        if (action === "offer") {
            const m = peerMeta.get(from) || { polite: true, makingOffer: false, ignoreOffer: false };
            peerMeta.set(from, m);

            const offerCollision = m.makingOffer || (pc && pc.signalingState !== "stable");
            const ignore = !m.polite && offerCollision;
            if (ignore) {
                console.warn("Ignorando offer por colisión (impolite)");
                return;
            }
            if (!pc) {
                pc = createPeer(from, false);
            }
            if (offerCollision) {
                await pc.setLocalDescription({ type: "rollback" });
            }
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal(from, "answer", pc.localDescription);
        }

        // Si recibo answer
        if (action === "answer" && pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
        }

        // Si recibo ICE
        if (action === "ice") {
            try {
                if (!pc) {
                    pc = createPeer(from, false);
                }
                await pc.addIceCandidate(new RTCIceCandidate(payload));
            } catch (err) {
                console.error("Error ICE:", err);
            }
        }
    });
}

// Suscribirse a la lista de jugadores para auto-conectar peers web
onPlayers(connectToList);

/* ========== API extra ========== */
export function getLocalStream() {
    return localStream;
}
export function setMicState(enabled) {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = enabled;
        });
    }   
}

export function setPeerVolume(peerId, volume) {
    const state = peerState.get(peerId) || defaultPeerState();
    state.volume = Math.min(1, Math.max(0, volume));
    peerState.set(peerId, state);
    applyVolume(peerId, state);
}

export function setPeerMuted(peerId, muted) {
    const state = peerState.get(peerId) || defaultPeerState();
    state.muted = muted;
    peerState.set(peerId, state);
    applyVolume(peerId, state);
}

export function onPeerSpeaking(handler) {
    speakingCb = handler;
}
