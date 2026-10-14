/**
 * Aritmética monetaria segura para la capa de presentación. El backend calcula todo con Decimal; en pantalla solo
 * hace falta sumar para previsualizar. Se suman centavos enteros para que 0.1 + 0.2 sea 0.30 y no 0.30000000000000004.
 */
export function aCentavos(valor: number | string | null | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function sumarMonedas(valores: Array<number | string | null | undefined>): number {
  return valores.reduce<number>((acc, v) => acc + aCentavos(v), 0) / 100;
}

export function restarMonedas(a: number | string | null | undefined, b: number | string | null | undefined): number {
  return (aCentavos(a) - aCentavos(b)) / 100;
}

/** ¿Es un importe positivo con a lo sumo 2 decimales (según se escribió, no según el binario del `number`)? */
export function esImporteValido(valor: unknown): boolean {
  if (valor === null || valor === undefined || valor === '') return false;
  const texto = String(valor).trim();
  return /^\d+(\.\d{1,2})?$/.test(texto) && Number(texto) > 0;
}

/** Porcentaje 0–100 con 1 decimal para barras de progreso (meta ≤ 0 → 0). */
export function porcentajeAvance(real: number | null | undefined, meta: number | null | undefined): number {
  const m = Number(meta);
  const r = Number(real);
  if (!Number.isFinite(m) || !Number.isFinite(r) || m <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((r / m) * 1000) / 10));
}
