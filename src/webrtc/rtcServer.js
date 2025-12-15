/**
 * Helper para rutear mensajes de señalización WebRTC entre clientes.
 * Usa un mapa id -> ws y un callback de autorización.
 */
export function forwardSignal(clientsById, from, { to, action, payload }, canRouteVoice, onDrop) {
    if (!to || !action) return;

    if (canRouteVoice && !canRouteVoice(from, to)) {
        onDrop?.(from, to, "forbidden");
        return;
    }

    const target = clientsById.get(to);
    if (!target || target.readyState !== target.OPEN) {
        onDrop?.(from, to, "closed");
        return;
    }

    target.send(JSON.stringify({ type: "signal", from, action, payload }));
}
