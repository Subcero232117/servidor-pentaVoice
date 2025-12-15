/* ==============================================================
   SUBVOICE - Types System
   Aquí definimos los estados oficiales del sistema de voz.
   Nada de inventar después, todo se valida desde aquí.
   ============================================================== */

/**
 * Modo actual de voz del jugador.
 * Afecta con quién puede hablar y quién lo escucha.
 */
export const VoiceMode = {
    GLOBAL: "global",   // Habla normal con todos (por distancia)
    TEAM: "team",       // Habla solo con su equipo
    MUTE: "mute",       // No emite audio de ningún tipo
    DEAD: "dead"        // Futuro: modo espectador o muerto
};

/**
 * Colores válidos como Team/Tag.
 * Estos son simples string ("red", "blue", etc.)
 * Si un jugador no tiene color, el server lo pone "none".
 */
export const TeamColor = {
    NONE: "none",
    RED: "red",
    BLUE: "blue",
    GREEN: "green",
    YELLOW: "yellow",
    PURPLE: "purple",
    ORANGE: "orange"
};

/**
 * Estados de conexión para WebRTC
 * Son internos del server, no se mandan al cliente
 */
export const PeerSignalType = {
    OFFER: "offer",
    ANSWER: "answer",
    ICE: "ice"
};

/**
 * Estados de red del cliente web
 * Esto se usa para UI tipo "online / loading / error"
 */
export const ClientState = {
    CONNECTED: "connected",
    DISCONNECTED: "disconnected",
    PENDING: "pending",
    FAILED: "failed"
};
