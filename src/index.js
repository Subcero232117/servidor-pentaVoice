/* ==============================================================
   SUBVOICE - MAIN SERVER
   Servidor Web + WebSockets + Logic + PlayerManager conectado.
   ============================================================== */

import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

/* =========================
   CORE
   ========================= */
import { playerManager } from "./core/playerManager.js";
import { VoiceMode } from "./core/types.js";

/* =========================
   UTILS
   ========================= */
import { createLogger } from "./utils/logger.js";
import { normalizeTeamColor } from "./utils/teams.js";
import { modeFromState } from "./utils/modes.js";

/* =========================
   SECURITY
   ========================= */
import { createRateLimiter } from "./security/rateLimit.js";

/* =========================
   WEBRTC
   ========================= */
import { forwardSignal } from "./webrtc/rtcServer.js";

/* =========================
   API
   ========================= */
import { mountVoiceRoutes } from "./api/voiceRoutes.js";

/* =========================
   __dirname (ESModules)
   ========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================
   WEB + HTTP SERVER
   ========================= */
const app = express();
const server = http.createServer(app);

/* ====== WEB ROOT ====== */
const WEB_ROOT = path.resolve(__dirname, "../web");

/* ====== MIDDLEWARE ====== */
app.use(express.json());
app.use(express.static(path.join(WEB_ROOT, "public")));
app.use("/src", express.static(path.join(WEB_ROOT, "src")));

/* ====== INDEX ====== */
app.get("/", (_, res) => {
    res.sendFile(path.join(WEB_ROOT, "public/index.html"));
});

/* ====== API ====== */
let ROOM_ID = "LOCAL-TEST";
mountVoiceRoutes(app, {
    playerManager,
    getRoomId: () => ROOM_ID
});

/* =========================
   WEBSOCKET SERVER
   ========================= */
const wss = new WebSocketServer({ server });
const clientsById = new Map();
const log = createLogger("ws");

/* =========================
   BROADCAST
   ========================= */
function broadcastPlayerUpdate() {
    const list = playerManager.getAll();
    for (const ws of clientsById.values()) {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "players", list }));
        }
    }
}

/* =========================
   VOICE ROUTING
   ========================= */
function canRouteVoice(from, to) {
    return playerManager.canListen(to, from);
}

/* =========================
   NUEVO CLIENTE
   ========================= */
wss.on("connection", ws => {
    let id = null;
    let isWebClient = false;
    let pingInterval = null;

    const signalLimiter = createRateLimiter({
        limit: 50,
        windowMs: 10_000
    });

    /* ===== REGISTER ===== */
    function registerClient(newId, defaults = {}) {
        id = newId;
        clientsById.set(id, ws);

        playerManager.addOrUpdate(id, {
            name: newId,
            team: "none",
            voiceMode: VoiceMode.GLOBAL,
            muted: false,
            pos: { x: 0, y: 0, z: 0 },
            ...defaults
        });
    }

    /* ===== VOICE STATE ===== */
    function applyVoiceState(state = {}) {
        const mode = modeFromState(state);
        playerManager.setVoiceMode(id, mode);

        if (state.teamColor) {
            playerManager.setTeam(id, normalizeTeamColor(state.teamColor));
        }

        if (typeof state.mute === "boolean") {
            playerManager.setMuted(id, state.mute);
        }
    }

    /* ===== PING ===== */
    function startPing() {
        if (pingInterval) return;

        pingInterval = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    type: "ping",
                    value: Math.floor(20 + Math.random() * 80)
                }));
            }
        }, 1000);
    }

    /* =========================
       MENSAJES
       ========================= */
    ws.on("message", raw => {
        let data;
        try {
            data = JSON.parse(raw);
        } catch {
            return;
        }

        /* ===== WEB HANDSHAKE ===== */
        if (!id && data.type === "hello_web" && data.clientId) {
            isWebClient = true;
            registerClient(data.clientId);

            ws.send(JSON.stringify({
                type: "room",
                id,
                value: ROOM_ID
            }));

            broadcastPlayerUpdate();
            startPing();
            log.info(`Conectado web: ${id}`);
            return;
        }

        /* ===== BP HANDSHAKE ===== */
        if (!id && data.player) {
            registerClient(`mc:${data.player}`, { name: data.player });
            applyVoiceState(data.data || data.state || {});
            broadcastPlayerUpdate();
            log.info(`Conectado BP: ${id}`);
        }

        if (!id) return;

        /* ===== STATE ===== */
        if (data.type === "state") {
            applyVoiceState(data.data || {});
            broadcastPlayerUpdate();
        }

        /* ===== MIC ===== */
        if (data.type === "mic") {
            playerManager.setMuted(id, !data.state);
            broadcastPlayerUpdate();
        }

        /* ===== HEARTBEAT ===== */
        if (data.type === "ping") {
            ws.send(JSON.stringify({
                type: "pong",
                timestamp: Date.now()
            }));
        }

        /* ===== NAME ===== */
        if (data.type === "set_name" && typeof data.name === "string") {
            playerManager.addOrUpdate(id, {
                name: data.name.trim().slice(0, 24)
            });
            broadcastPlayerUpdate();
        }

        /* ===== TEAM VOICE ===== */
        if (data.type === "teamv") {
            const enabled = data.enabled ?? data.data;
            playerManager.setVoiceMode(
                id,
                enabled ? VoiceMode.TEAM : VoiceMode.GLOBAL
            );

            if (isWebClient) {
                ws.send(JSON.stringify({ type: "teamv", enabled }));
            }

            broadcastPlayerUpdate();
        }

        /* ===== TEAM COLOR ===== */
        if (data.type === "team") {
            playerManager.setTeam(id, normalizeTeamColor(data.color));
            broadcastPlayerUpdate();
        }

        /* ===== POSITION ===== */
        if (data.type === "pos") {
            playerManager.setPlayerPos(id, data.pos || data.data);
        }

        /* ===== SIGNAL ===== */
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

            forwardSignal(
                clientsById,
                id,
                { to, action, payload },
                canRouteVoice,
                (from, dest, reason) => {
                    log.warn(`No se pudo rutear ${from} → ${dest} (${reason})`);
                }
            );
        }
    });

    /* =========================
       DISCONNECT
       ========================= */
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

/* =========================
   START SERVER
   ========================= */
const PORT = process.env.PORT || 8000;

server.listen(PORT, "0.0.0.0", () => {
    console.log("\n==========================================");
    console.log(`🌐 SubVoice Server: http://localhost:${PORT}/`);
    console.log("📡 WS + Player Manager listos");
    console.log("🎮 Falta conectar Minecraft para Posición/Tags");
    console.log("==========================================\n");
});
