import { EstadoCuentaPersona } from '../modelos/erp';
import { CompraDePersona, DesgloseTarjeta, EstadoCuotaPersona, EstadoDeudaPersona, ResumenPersona } from '../modelos/estado-cuenta-personas';

export const MODAL_ABONO_PERSONA = 'abono-persona-form';

const ETIQUETA_CUOTA: Record<EstadoCuotaPersona, string> = { PAGADA: 'Pagada', PARCIAL: 'Pagada en parte', PENDIENTE: 'Pendiente' };
const CLASE_CUOTA: Record<EstadoCuotaPersona, string> = { PAGADA: 'erp-badge--success', PARCIAL: 'erp-badge--warning', PENDIENTE: '' };
const ETIQUETA_DEUDA: Record<EstadoDeudaPersona, string> = { DEBE: 'Debe', A_FAVOR: 'A favor', PAZ_Y_SALVO: 'Al día' };
const CLASE_DEUDA: Record<EstadoDeudaPersona, string> = { DEBE: 'erp-badge--warning', A_FAVOR: 'erp-badge--success', PAZ_Y_SALVO: 'erp-badge--success' };

export const etiquetaEstadoCuota = (e: string | null | undefined): string => ETIQUETA_CUOTA[e as EstadoCuotaPersona] ?? 'Pendiente';
export const claseEstadoCuota = (e: string | null | undefined): string => CLASE_CUOTA[e as EstadoCuotaPersona] ?? '';
export const etiquetaEstadoDeuda = (e: string | null | undefined): string => ETIQUETA_DEUDA[e as EstadoDeudaPersona] ?? '';
export const claseEstadoDeuda = (e: string | null | undefined): string => CLASE_DEUDA[e as EstadoDeudaPersona] ?? '';

export function iniciales(nombre: string | null | undefined, guardadas?: string | null): string {
  if (guardadas && guardadas.trim()) return guardadas.trim().slice(0, 2).toUpperCase();
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase();
}

/** «Cuota 2 de 12» (o «Cuota 2 de 3 (de 12)» cuando solo le tocan las primeras 3 cuotas de la compra). */
export function textoCuota(c: CompraDePersona): string {
  const n = c.cuotaDelMes?.numero;
  if (!n) return `${c.cuotasDeLaPersona} ${c.cuotasDeLaPersona === 1 ? 'cuota' : 'cuotas'}`;
  return c.cuotasDeLaPersona < c.numeroCuotasCompra ? `Cuota ${n} de ${c.cuotasDeLaPersona} (de ${c.numeroCuotasCompra})` : `Cuota ${n} de ${c.numeroCuotasCompra}`;
}

/** «50 %» / «33,5 %» */
export function textoPorcentaje(p: number | null | undefined): string {
  const v = Number(p ?? 0);
  return `${Number.isInteger(v) ? v : v.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`;
}

export interface SegmentoTarjeta {
  clave: string;
  tarjeta: string;
  monto: number;
  /** 0–100, redondeado a 1 decimal. */
  porcentaje: number;
  color: string;
}

const COLORES = ['var(--chart-1)', 'var(--chart-3)', 'var(--chart-6)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-2)'];

export const claveTarjeta = (t: Pick<DesgloseTarjeta, 'tarjetaId'>): string => (t.tarjetaId === null ? 'sin-tarjeta' : String(t.tarjetaId));
export const nombreTarjeta = (t: Pick<DesgloseTarjeta, 'tarjeta' | 'tarjetaId'>): string => t.tarjeta || (t.tarjetaId === null ? 'Sin tarjeta' : `Tarjeta #${t.tarjetaId}`);

/** Cuánto del pago del mes viene de cada tarjeta (para la barra apilada de la tarjeta de la persona). */
export function segmentosPorTarjeta(porTarjeta: DesgloseTarjeta[], base: 'totalMes' | 'porVencer' = 'totalMes'): SegmentoTarjeta[] {
  const filas = porTarjeta.filter((t) => Number(t[base]) > 0);
  const total = filas.reduce((a, t) => a + Number(t[base]), 0);
  return filas.map((t, i) => ({
    clave: claveTarjeta(t),
    tarjeta: nombreTarjeta(t),
    monto: Number(t[base]),
    porcentaje: total > 0 ? Math.round((Number(t[base]) / total) * 1000) / 10 : 0,
    color: COLORES[i % COLORES.length],
  }));
}

/** Los formularios de abono trabajan con la forma del sub-ledger: se arma con lo que ya debe pagar la persona ahora. */
export function aPersonaDeAbono(r: ResumenPersona): EstadoCuentaPersona {
  return {
    persona_id: r.persona.id,
    nombre: r.persona.nombre,
    iniciales_nombre: r.persona.iniciales,
    color_representativo: r.persona.color,
    cuotas_tc_mes: r.pagoDelMesTarjetas,
    recurrentes_compartidos_mes: null,
    prestamos_mes: null,
    cruces_asumidos_mes: null,
    abonos_recibidos_mes: r.abonosDelMes,
    saldo_neto_mes: r.pagoDelMes,
    saldo_total_acumulado: r.saldoExigible,
  };
}
