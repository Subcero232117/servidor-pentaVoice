/**
 * Calcula quién puede escuchar a quién según posición y dimensión.
 * players: Map<string, { name, pos: {x,y,z,dim} }>
 * return: Map<id, string[]> de nombres que puede oír cada jugador.
 */
export function computeHearMap(players, maxDistance = 32) {
    const result = new Map();
    const arr = Array.from(players.entries());

    for (const [id, me] of arr) {
        const hear = [];
        if (!me?.pos) { result.set(id, hear); continue; }
        for (const [oid, other] of arr) {
            if (id === oid) continue;
            if (!other?.pos) continue;
            if (me.pos.dim && other.pos.dim && me.pos.dim !== other.pos.dim) continue;

            const dx = (me.pos.x ?? 0) - (other.pos.x ?? 0);
            const dy = (me.pos.y ?? 0) - (other.pos.y ?? 0);
            const dz = (me.pos.z ?? 0) - (other.pos.z ?? 0);
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq <= maxDistance * maxDistance) {
                hear.push(other.name || oid);
            }
        }
        result.set(id, hear);
    }
    return result;
}

/**
 * Inserta el campo hear en el objeto de cada jugador y devuelve una copia plana.
 */
export function projectHearList(players, maxDistance = 32) {
    const hearMap = computeHearMap(players, maxDistance);
    return Array.from(players.entries()).map(([id, data]) => ({
        id,
        name: data.name || id,
        hear: hearMap.get(id) ?? []
    }));
}
