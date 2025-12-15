/**
 * Rate limiter simple por clave (por ejemplo, cliente WebSocket).
 * limit: cantidad de acciones permitidas por ventana.
 * windowMs: duración de la ventana en milisegundos.
 */
export function createRateLimiter({ limit = 30, windowMs = 5000 } = {}) {
    const buckets = new Map();

    return function allow(key = "default") {
        const now = Date.now();
        let bucket = buckets.get(key);
        if (!bucket || now - bucket.start >= windowMs) {
            bucket = { start: now, count: 0 };
            buckets.set(key, bucket);
        }
        bucket.count += 1;
        return bucket.count <= limit;
    };
}
