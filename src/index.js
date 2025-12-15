/* ==============================================================
   SUBVOICE - MAIN SERVER
   Servidor Web + WebSockets + Logic + PlayerManager conectado.
   ============================================================== */

import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

import { playerManager } from "./core/playerManager.js";
import { VoiceMode } from "./core/types.js";
import { createLogger } from "./utils/logger.js";
import { normalizeTeamColor } from "./utils/teams.js";
import { modeFromState } from "./utils/modes.js";
import { createRateLimiter } from "./security/rateLimit.js";
import { forwardSignal } from "./webrtc/rtcServer.js";
import { mountVoiceRoutes } from "./api/voiceRoutes.js";

/* ============================
   __dirname para ESModules
   ============================ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ============================
   WEB + HTTP SERVER
   ============================ */
const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "../../web/public")));
app.use("/src", express.static(path.join(__dirname, "../../web/src")));
app.use(express.json());
mountVoiceRoutes(app, { playerManager, getRoomId: () => ROOM_ID });

/* ============================
   WEBSOCKET SERVER
   ============================ */
const wss = new WebSocketServer({ server });
const clientsById = new Map();
let ROOM_ID = "LOCAL-TEST";
const log = createLogger("ws");

/* ============================
   BROADCAST
   ============================ */
function broadcastPlayerUpdate() {
    const list = playerManager.getAll();
    for (const ws of clientsById.values()) {
        if (ws.readyState === ws.OPEN)
            ws.send(JSON.stringify({ type: "players", list }));
    }
}

/* ============================
   VOICE ROUTER
   ============================ */
function canRouteVoice(from, to) {
    return playerManager.canListen(to, from);
}

/* ============================
   NUEVO CLIENTE
   ============================ */
wss.on("connection", ws => {
    let id = null;
    let pingInterval = null;
    let isWebClient = false;
    const signalLimiter = createRateLimiter({ limit: 50, windowMs: 10000 });

    const registerClient = (newId, defaults = {}) => {
        id = newId;
        clientsById.set(id, ws);
        playerManager.addOrUpdate(id, {
            team: "none",
            voiceMode: VoiceMode.GLOBAL,
            pos: { x: 0, y: 0, z: 0 },
            name: newId,
            ...defaults
        });
    };

    const applyVoiceState = (state = {}) => {
        const mode = modeFromState(state);
        playerManager.setVoiceMode(id, mode);
        if (state.teamColor) {
            playerManager.setTeam(id, normalizeTeamColor(state.teamColor));
        }
    };

    const startPing = () => {
        if (pingInterval) return;
        pingInterval = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    type: "ping",
                    value: Math.floor(20 + Math.random() * 80)
                }));
            }
        }, 1000);
    };

    /* ========= MENSAJES ========= */
    ws.on("message", raw => {
        let data; try { data = JSON.parse(raw); } catch { return; }

        // Handshake inicial desde la web: fija ID para ruteo WebRTC
        if (!id && data.type === "hello_web" && data.clientId) {
            isWebClient = true;
            registerClient(data.clientId);

            ws.send(JSON.stringify({ type: "room", value: ROOM_ID, id }));
            broadcastPlayerUpdate();
            startPing();
            log.info(`Conectado web: ${id}`);
            return;
        }

        // Handshake desde BP (usa nombre del jugador)
        if (!id && data.player) {
            registerClient(`mc:${data.player}`, { name: data.player });
            applyVoiceState(data.data || data.state || {});
            broadcastPlayerUpdate();
            log.info(`Conectado BP: ${id}`);
            // no return; procesamos el mensaje recibido
        }

        if (!id) return; // Ignorar mensajes antes del handshake

        // Estado inicial o forzado desde BP
        if (data.type === "state") {
            applyVoiceState(data.data || {});
            broadcastPlayerUpdate();
        }

        // Mic ON/OFF
        if (data.type === "mic") {
            playerManager.setMuted(id, !data.state);
            broadcastPlayerUpdate();
        }

        // Heartbeat desde web
        if (data.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", timestamp: data.timestamp || Date.now() }));
        }

        // Nombre / nametag desde web
        if (data.type === "set_name" && typeof data.name === "string") {
            playerManager.addOrUpdate(id, { name: data.name.trim().slice(0, 24) });
            broadcastPlayerUpdate();
        }

        // Mute desde BP
        if (data.type === "mute") {
            applyVoiceState({ mute: data.data === true });
            broadcastPlayerUpdate();
        }

        // Team Voice
        if (data.type === "teamv") {
            const enabled = data.enabled ?? data.data;
            playerManager.setVoiceMode(id, enabled ? VoiceMode.TEAM : VoiceMode.GLOBAL);
            if (isWebClient) {
                ws.send(JSON.stringify({ type: "teamv", enabled }));
            }
            broadcastPlayerUpdate();
        }

        // Set team color
        if (data.type === "team") {
            playerManager.setTeam(id, normalizeTeamColor(data.color));
            broadcastPlayerUpdate();
        }

        // Posición (futuro de MC)
        if (data.type === "pos") {
            playerManager.setPlayerPos(id, data.pos || data.data);
        }

        // Señal de WebRTC
        if (data.type === "signal") {
            const { to, action, payload } = data;

            if (!signalLimiter(id)) {
                log.warn(`Rate limit signal de ${id}`);
                return;
            }

            if (!canRouteVoice(id, to)) {
                log.warn(`Bloqueado ${id} → ${to}`);
                return;
            }

            forwardSignal(clientsById, id, { to, action, payload }, canRouteVoice, (from, dest, reason) => {
                log.warn(`No se pudo rutear ${from} → ${dest} (${reason})`);
            });
        }
    });

    /* ========= CLIENTE FUERA ========= */
    ws.on("close", () => {
        if (pingInterval) clearInterval(pingInterval);
        if (id) {
            log.info(`Desconectado: ${id}`);
            playerManager.remove(id);
            clientsById.delete(id);
            broadcastPlayerUpdate();
        }
    });
});

/* ============================
   INICIAR SERVER
   ============================ */
const PORT = process.env.PORT || 8000;

server.listen(PORT, "0.0.0.0" () => {
    console.log("\n==========================================");
    console.log(`🌐 SubVoice Server: http://localhost:${PORT}/`);
    console.log("📡 WS + Player Manager listos");
    console.log("🎮 Falta conectar Minecraft para Posición/Tags");
    console.log("==========================================\n");
});
