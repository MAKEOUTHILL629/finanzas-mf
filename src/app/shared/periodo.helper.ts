import { months } from '../modelos/compras-credito';

/** Periodo contable `YYYY-MM` (el mismo formato que usa la BD en `periodo`, `periodo_facturacion`, etc.). */
const PERIODO = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function esPeriodoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && PERIODO.test(valor);
}

/** Zona horaria de la app: «hoy» es el día en Colombia aunque el navegador (o un servidor) esté en otro huso. */
export const ZONA_HORARIA = 'America/Bogota';
const FORMATO_BOGOTA = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' });

const FORMATO_BOGOTA_HORA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Un instante como valor de `<input type="datetime-local">` (`yyyy-MM-ddTHH:mm`) en hora de Colombia. */
export function aDatetimeLocalBogota(d: Date): string {
  const p = Object.fromEntries(FORMATO_BOGOTA_HORA.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}`;
}

/** Lo contrario: el `datetime-local` que escribió el usuario se entiende en hora de Colombia (UTC-5, sin horario de verano). */
export function desdeDatetimeLocalBogota(valor: string): Date {
  const completo = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor) ? `${valor}:00` : valor;
  return new Date(`${completo}-05:00`);
}

/** Periodo del mes en curso (en hora de Colombia). */
export function periodoActual(ahora: Date = new Date()): string {
  return hoyIso(ahora).slice(0, 7);
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

/** Fecha de hoy en hora de Colombia (`America/Bogota`) como `yyyy-MM-dd`, lista para un `<input type="date">`. */
export function hoyIso(ahora: Date = new Date()): string {
  const partes = Object.fromEntries(FORMATO_BOGOTA.formatToParts(ahora).map((p) => [p.type, p.value]));
  return `${partes['year']}-${partes['month']}-${partes['day']}`;
}

/** Último día (`yyyy-MM-dd`) de un periodo. */
export function finDePeriodo(periodo: string): string {
  const m = PERIODO.exec(periodo);
  if (!m) throw new Error(`Periodo inválido: ${periodo}`);
  const ultimo = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  return `${periodo}-${String(ultimo).padStart(2, '0')}`;
}
