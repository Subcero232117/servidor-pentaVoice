/**
 * Añade un gradiente y callback a un slider de volumen (0-1).
 * Devuelve controles para actualizar o destruir listeners.
 */
export function initVolumeBar(slider, onChange) {
    if (!slider) return {};

    const clamp01 = v => Math.min(1, Math.max(0, v));

    const paint = value => {
        const pct = Math.round(clamp01(value) * 100);
        slider.style.background = `linear-gradient(90deg, #39dfff ${pct}%, #333 ${pct}%)`;
    };

    const handleInput = e => {
        const raw = Number(e.target.value) / 100;
        const value = clamp01(raw);
        paint(value);
        onChange?.(value);
    };

    slider.addEventListener("input", handleInput);

    // Inicializa con el valor actual del slider
    const initial = clamp01(Number(slider.value) / 100 || 0.5);
    paint(initial);
    onChange?.(initial);

    return {
        setValue(v) {
            const value = clamp01(v);
            slider.value = Math.round(value * 100);
            paint(value);
        },
        destroy() {
            slider.removeEventListener("input", handleInput);
        }
    };
}
