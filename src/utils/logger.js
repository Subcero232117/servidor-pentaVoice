/**
 * Logger simple con timestamp y etiqueta de contexto.
 * Evita repetir console.* en todo el servidor.
 */
const ts = () => new Date().toISOString();

export function createLogger(scope = "subvoice") {
    const fmt = (level, args) => [`[${ts()}][${scope}][${level}]`, ...args];
    return {
        info:  (...args) => console.log(...fmt("INFO", args)),
        warn:  (...args) => console.warn(...fmt("WARN", args)),
        error: (...args) => console.error(...fmt("ERROR", args))
    };
}

// Logger por defecto
export const log = createLogger("subvoice");
