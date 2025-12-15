/* ==============================================================
   SUBVOICE - PLAYER MANAGER
   Administra jugadores: team, voz, mute, posicion, estado.
   ============================================================== */

import { VoiceMode, TeamColor } from "./types.js";

class PlayerManager {
    constructor() {
        this.players = new Map(); // id → data
    }

    /* =======================
       CREAR O ACTUALIZAR
       ======================= */
    addOrUpdate(id, data) {
        const prev = this.players.get(id) || {};
        this.players.set(id, { ...prev, ...data });
    }

    remove(id) {
        this.players.delete(id);
    }

    /* =======================
       GETTERS
       ======================= */
    get(id) {
        return this.players.get(id);
    }

    getAll() {
        return Object.fromEntries(this.players);
    }

    /* =======================
       TEAM / MUTE / MODE
       ======================= */
    setTeam(id, color) {
        if (!Object.values(TeamColor).includes(color)) color = TeamColor.NONE;
        this.addOrUpdate(id, { team: color });
    }

    setVoiceMode(id, mode) {
        if (!Object.values(VoiceMode).includes(mode)) return;
        this.addOrUpdate(id, { voiceMode: mode });
    }

    setMuted(id, muted) {
        if (muted) this.setVoiceMode(id, VoiceMode.MUTE);
        else this.setVoiceMode(id, VoiceMode.GLOBAL);
    }

    /* =======================
       POSICIÓN DE JUGADORES
       (solo usada cuando venga MC)
       ======================= */
    setPlayerPos(id, pos) {
        if (!pos) return;
        this.addOrUpdate(id, { pos });
    }

    /* =======================
       LOGICA DE ESCUCHA
       ======================= */
    canListen(listener, speaker, distLimit = 10) {
        const L = this.players.get(listener);
        const S = this.players.get(speaker);
        if (!L || !S) return false;

        // No habla si está mute o dead
        if (S.voiceMode === VoiceMode.MUTE || S.voiceMode === VoiceMode.DEAD)
            return false;

        // Team mode estricto
        if (S.voiceMode === VoiceMode.TEAM) {
            return S.team && L.team && S.team === L.team;
        }

        // Dimensiones diferentes (si se conocen)
        if (S.pos?.dim && L.pos?.dim && S.pos.dim !== L.pos.dim) {
            return false;
        }

        // GLOBAL por distancia
        const px = L.pos?.x ?? 0, pz = L.pos?.z ?? 0;
        const sx = S.pos?.x ?? 0, sz = S.pos?.z ?? 0;
        const dist = Math.sqrt((px - sx) ** 2 + (pz - sz) ** 2);

        return dist <= distLimit;
    }
}

export const playerManager = new PlayerManager();
