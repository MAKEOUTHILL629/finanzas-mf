/**
 * Lee un token del sistema de diseño (`--chart-1`, `--text-secondary`…) ya resuelto para el tema actual.
 * Chart.js dibuja en <canvas> y no entiende `var(--x)`: los colores de los gráficos se piden aquí en vez de escribirlos a mano.
 */
export function token(nombre: string, respaldo = ''): string {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return respaldo;
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || respaldo;
}

/** `#RRGGBB` o `rgb()` con transparencia (para rellenos de gráficos); si el color no es hexadecimal se devuelve igual. */
export function conAlfa(color: string, alfa: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}
