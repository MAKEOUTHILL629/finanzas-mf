import { MovimientoDashboard, ResumenDashboard } from '../modelos/dashboard';
import { moneda } from '../shared/moneda.util';

/** «Buenos días» de 5:00 a 11:59, «Buenas tardes» hasta las 18:59 y «Buenas noches» el resto. */
export function saludoSegunHora(ahora: Date = new Date()): string {
  const h = ahora.getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Primer nombre para el saludo («Luis Felipe Hernández» → «Luis»); vacío si no hay nombre. */
export function primerNombre(nombre: string | null | undefined): string {
  return (nombre ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * El resumen en una frase: «Tienes $X disponibles y $Y por cobrar este mes.» Si hay una tarjeta por vencer pronto se agrega.
 * Los montos van con el mismo formato que el resto de la aplicación.
 */
export function fraseEjecutiva(r: ResumenDashboard): string {
  const partes = [`Tienes ${moneda(r.liquidez.total)} disponibles`];
  if (r.porCobrar.pagoDelMes > 0) partes.push(`${moneda(r.porCobrar.pagoDelMes)} por cobrar este mes`);
  let frase = partes.length === 2 ? `${partes[0]} y ${partes[1]}.` : `${partes[0]}.`;
  const v = r.proximosVencimientos.find((x) => !x.vencido && x.diasRestantes <= 7);
  if (v) frase += ` ${v.tarjeta} vence ${v.diasRestantes === 0 ? 'hoy' : v.diasRestantes === 1 ? 'mañana' : `en ${v.diasRestantes} días`}.`;
  return frase;
}

/** «Hoy», «Mañana», «En 5 días», «Hace 3 días». */
export function textoDias(dias: number): string {
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  return dias > 0 ? `En ${dias} días` : `Hace ${-dias} días`;
}

/** Tono de la insignia de un vencimiento: vencido o ≤ 3 días = peligro, ≤ 7 = aviso, el resto neutro. */
export function tonoVencimiento(dias: number, vencido: boolean): 'danger' | 'warning' | 'neutral' {
  if (vencido || dias <= 3) return 'danger';
  return dias <= 7 ? 'warning' : 'neutral';
}

const ICONO_TIPO: Record<string, string> = {
  INGRESO: 'south_west',
  EGRESO: 'north_east',
  TRANSFERENCIA: 'swap_horiz',
  PAGO_TARJETA: 'credit_card',
  PAGO_PRESTAMO: 'account_balance_wallet',
  REEMBOLSO_TERCERO: 'undo',
};

export const iconoMovimiento = (tipo: string): string => ICONO_TIPO[tipo] ?? 'receipt_long';

/** ¿Suma al saldo? (ingresos y reembolsos de terceros entran; lo demás sale o se mueve). */
export const esEntrada = (m: Pick<MovimientoDashboard, 'tipo'>): boolean => m.tipo === 'INGRESO' || m.tipo === 'REEMBOLSO_TERCERO';

/** Porcentaje 0–100 con un decimal (el ancho de una barra); 0 si la base no es positiva. */
export function porcentaje(parte: number, total: number): number {
  if (!(total > 0) || !(parte > 0)) return 0;
  return Math.min(100, Math.round((parte / total) * 1000) / 10);
}

/** Reparte ingresos y gastos propios del mes en dos barras comparables (la mayor ocupa el 100 %). */
export function barrasFlujo(ingresos: number, gastos: number): { ingresos: number; gastos: number } {
  const base = Math.max(ingresos, gastos, 0);
  return { ingresos: porcentaje(ingresos, base), gastos: porcentaje(gastos, base) };
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Día de un movimiento en hora local: «Hoy», «Ayer» o «14 oct». Los movimientos llevan hora (no son fechas de calendario),
 * así que se leen en la zona del usuario y no en UTC.
 */
export function diaDeMovimiento(iso: string, ahora: Date = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const inicio = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((inicio(ahora) - inicio(d)) / 86_400_000);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

/** «Viernes 16 de octubre» para el encabezado de bienvenida. */
export function fechaLarga(ahora: Date = new Date()): string {
  const texto = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(ahora);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
