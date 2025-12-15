import { TeamColor } from "../core/types.js";

export function normalizeTeamColor(color) {
    if (!color) return TeamColor.NONE;
    const lower = String(color).toLowerCase();
    return Object.values(TeamColor).includes(lower) ? lower : TeamColor.NONE;
}

export function isSameTeam(a, b) {
    if (!a || !b) return false;
    return normalizeTeamColor(a) === normalizeTeamColor(b) && normalizeTeamColor(a) !== TeamColor.NONE;
}

export function randomTeam() {
    const pool = Object.values(TeamColor).filter(t => t !== TeamColor.NONE);
    return pool[Math.floor(Math.random() * pool.length)];
}
