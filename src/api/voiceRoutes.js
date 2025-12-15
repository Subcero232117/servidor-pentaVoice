import express from "express";
import { normalizeTeamColor } from "../utils/teams.js";
import { VoiceMode } from "../core/types.js";

/**
 * Rutas HTTP para exponer estado y permitir setear nombre/equipo desde web.
 */
export function mountVoiceRoutes(app, { playerManager, getRoomId }) {
    const router = express.Router();

    router.get("/health", (_req, res) => res.json({ ok: true }));

    router.get("/room", (_req, res) => {
        res.json({ room: getRoomId() });
    });

    router.get("/players", (_req, res) => {
        res.json({ players: playerManager.getAll() });
    });

    router.post("/players/:id/name", (req, res) => {
        const { id } = req.params;
        const { name } = req.body || {};
        if (!name || !id) return res.status(400).json({ error: "id y name requeridos" });
        playerManager.addOrUpdate(id, { name: String(name).trim().slice(0, 24) });
        res.json({ ok: true });
    });

    router.post("/players/:id/team", (req, res) => {
        const { id } = req.params;
        const { team } = req.body || {};
        if (!team || !id) return res.status(400).json({ error: "id y team requeridos" });
        playerManager.setTeam(id, normalizeTeamColor(team));
        res.json({ ok: true });
    });

    router.post("/players/:id/mode", (req, res) => {
        const { id } = req.params;
        const { mode } = req.body || {};
        if (!mode || !id) return res.status(400).json({ error: "id y mode requeridos" });
        playerManager.setVoiceMode(id, mode);
        res.json({ ok: true });
    });

    app.use("/api/voice", router);
}
