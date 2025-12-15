/* ============================================
   SUBVOICE - Ping Smoother Utility (MEJORADO)
   Suaviza valores de ping con filtro exponencial
   ============================================ */

/**
 * Crea un suavizador de ping con filtro exponencial móvil (EMA)
 * @param {number} alpha - Factor de suavizado (0-1). Menor = más suave
 * @returns {Function} Función suavizadora con método reset
 */
export function createPingSmoother(alpha = 0.25) {
    let avg = null;
    let min = Infinity;
    let max = -Infinity;
    let count = 0;

    /**
     * Suavizar valor de ping
     * @param {number} pingMs - Valor de ping en milisegundos
     * @returns {number} Ping suavizado redondeado
     */
    const smoother = (pingMs) => {
        // Validación de entrada
        if (typeof pingMs !== "number" || Number.isNaN(pingMs)) {
            return avg ?? 0;
        }

        // Inicializar o actualizar promedio
        if (avg === null) {
            avg = pingMs;
        } else {
            avg = avg * (1 - alpha) + pingMs * alpha;
        }

        // Actualizar estadísticas
        count++;
        min = Math.min(min, pingMs);
        max = Math.max(max, pingMs);

        return Math.round(avg);
    };

    /**
     * Resetear el suavizador
     */
    smoother.reset = () => {
        avg = null;
        min = Infinity;
        max = -Infinity;
        count = 0;
    };

    /**
     * Obtener estadísticas actuales
     * @returns {Object} Objeto con estadísticas
     */
    smoother.getStats = () => ({
        current: avg !== null ? Math.round(avg) : null,
        min: min !== Infinity ? min : null,
        max: max !== -Infinity ? max : null,
        count
    });

    /**
     * Obtener el valor suavizado actual sin procesar nuevo valor
     * @returns {number} Ping suavizado actual
     */
    smoother.getCurrent = () => {
        return avg !== null ? Math.round(avg) : 0;
    };

    /**
     * Cambiar el factor de suavizado
     * @param {number} newAlpha - Nuevo factor (0-1)
     */
    smoother.setAlpha = (newAlpha) => {
        if (newAlpha >= 0 && newAlpha <= 1) {
            alpha = newAlpha;
        }
    };

    return smoother;
}

/**
 * Crear un monitor de ping con callbacks para rangos
 * @param {Object} options - Opciones de configuración
 * @returns {Object} Monitor de ping con API
 */
export function createPingMonitor(options = {}) {
    const {
        smoothing = 0.25,
        goodThreshold = 50,
        okThreshold = 100,
        badThreshold = 200,
        onGood = null,
        onOk = null,
        onBad = null,
        onCritical = null
    } = options;

    const smoother = createPingSmoother(smoothing);
    let currentRange = null;

    const monitor = (pingMs) => {
        const smoothed = smoother(pingMs);
        let range;

        // Determinar rango
        if (smoothed <= goodThreshold) {
            range = 'good';
        } else if (smoothed <= okThreshold) {
            range = 'ok';
        } else if (smoothed <= badThreshold) {
            range = 'bad';
        } else {
            range = 'critical';
        }

        // Ejecutar callback si cambió el rango
        if (range !== currentRange) {
            currentRange = range;
            
            switch (range) {
                case 'good':
                    onGood?.(smoothed);
                    break;
                case 'ok':
                    onOk?.(smoothed);
                    break;
                case 'bad':
                    onBad?.(smoothed);
                    break;
                case 'critical':
                    onCritical?.(smoothed);
                    break;
            }
        }

        return {
            value: smoothed,
            range,
            raw: pingMs
        };
    };

    monitor.reset = smoother.reset;
    monitor.getStats = smoother.getStats;
    monitor.getCurrentRange = () => currentRange;

    return monitor;
}

/**
 * Formatear ping con colores o emojis
 * @param {number} pingMs - Valor de ping
 * @param {boolean} useEmoji - Usar emoji en lugar de color
 * @returns {string} Ping formateado
 */
export function formatPing(pingMs, useEmoji = false) {
    if (typeof pingMs !== 'number' || Number.isNaN(pingMs)) {
        return useEmoji ? '❓ -- ms' : '-- ms';
    }

    if (useEmoji) {
        if (pingMs <= 50) return `🟢 ${pingMs} ms`;
        if (pingMs <= 100) return `🟡 ${pingMs} ms`;
        if (pingMs <= 200) return `🟠 ${pingMs} ms`;
        return `🔴 ${pingMs} ms`;
    }

    return `${pingMs} ms`;
}

/**
 * Calcular jitter (variación del ping)
 * @param {number[]} samples - Array de muestras de ping
 * @returns {number} Jitter promedio
 */
export function calculateJitter(samples) {
    if (!Array.isArray(samples) || samples.length < 2) {
        return 0;
    }

    let totalDiff = 0;
    for (let i = 1; i < samples.length; i++) {
        totalDiff += Math.abs(samples[i] - samples[i - 1]);
    }

    return Math.round(totalDiff / (samples.length - 1));
}