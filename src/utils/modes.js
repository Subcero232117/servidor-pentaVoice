import { VoiceMode } from "../core/types.js";

export function normalizeVoiceMode(mode) {
    if (!mode) return VoiceMode.GLOBAL;
    const lower = String(mode).toLowerCase();
    if (Object.values(VoiceMode).includes(lower)) return lower;
    return VoiceMode.GLOBAL;
}

export function isMutedMode(mode) {
    return mode === VoiceMode.MUTE || mode === VoiceMode.DEAD;
}

export function modeFromState({ mute = false, team = false } = {}) {
    if (mute) return VoiceMode.MUTE;
    if (team) return VoiceMode.TEAM;
    return VoiceMode.GLOBAL;
}
