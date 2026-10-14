import { months } from '../modelos/compras-credito';

/** Periodo contable `YYYY-MM` (el mismo formato que usa la BD en `periodo`, `periodo_facturacion`, etc.). */
const PERIODO = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function esPeriodoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && PERIODO.test(valor);
}

/** Periodo del mes en curso según el reloj del navegador. */
export function periodoActual(ahora: Date = new Date()): string {
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
}

/** `2026-12` + 1 → `2027-01`; admite desplazamientos negativos y mayores a 12. */
export function desplazarPeriodo(periodo: string, meses: number): string {
  const m = PERIODO.exec(periodo);
  if (!m) throw new Error(`Periodo inválido: ${periodo}`);
  const indice = Number(m[1]) * 12 + (Number(m[2]) - 1) + meses;
  const anio = Math.floor(indice / 12);
  return `${anio}-${String((indice % 12) + 1).padStart(2, '0')}`;
}

/** `2026-10` → `Octubre 2026` (cadena vacía si no es un periodo válido). */
export function nombrePeriodo(periodo: string | null | undefined): string {
  const m = periodo ? PERIODO.exec(periodo) : null;
  return m ? `${months[Number(m[2]) - 1]} ${m[1]}` : '';
}

/** Fecha de hoy (calendario local) como `yyyy-MM-dd`, lista para un `<input type="date">`. */
export function hoyIso(ahora: Date = new Date()): string {
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const dd = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mm}-${dd}`;
}

/** Último día (`yyyy-MM-dd`) de un periodo. */
export function finDePeriodo(periodo: string): string {
  const m = PERIODO.exec(periodo);
  if (!m) throw new Error(`Periodo inválido: ${periodo}`);
  const ultimo = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  return `${periodo}-${String(ultimo).padStart(2, '0')}`;
}
