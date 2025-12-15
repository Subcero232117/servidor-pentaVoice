/**
 * Envía instantáneas de jugadores a todos los clientes conectados.
 * Se puede invocar tras cambios relevantes para mantener UIs sincronizadas.
 */
export function broadcastPlayers(wss, payload) {
    const data = JSON.stringify(payload);
    wss.clients.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
            ws.send(data);
        }
    });
}
