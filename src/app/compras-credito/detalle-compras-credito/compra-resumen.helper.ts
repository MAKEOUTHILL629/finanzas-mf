import { ComprasCreditoMultimoneda, CuotaDetalle, EstadoRealCuota } from '../../modelos/compras-credito';
import { sumarMonedas } from '../../shared/dinero.helper';
import { normalizeSearchText } from '../../shared/utils';
import { TonoBadge } from '../../shared/ui/badge/badge.component';

/** Lógica pura del «inspector» de una compra a crédito: estado visible, datos que faltan y avance de las cuotas. */

export type ClaveEstadoVisual = 'pagada' | 'en-curso' | 'refinanciada' | 'cancelada' | 'otro';

export interface EstadoVisual {
  clave: ClaveEstadoVisual;
  etiqueta: string;
  tono: TonoBadge;
  icono: string;
}

const esPagada = (estado: string | null | undefined): boolean => normalizeSearchText(estado ?? '').startsWith('pagad');
const esRefinanciada = (estado: string | null | undefined): boolean => {
  const e = normalizeSearchText(estado ?? '');
  return e.startsWith('refinanci') || e.startsWith('ajuste') || e.startsWith('absorbid');
};

/** Estado que se muestra en la insignia del encabezado: Pagada · En curso · Refinanciada (más Cancelada). */
export function estadoVisualDeCompra(compra: { estado?: string | null; refinanciamientoId?: number | null }, cuotas: ReadonlyArray<CuotaDetalle> = []): EstadoVisual {
  if (compra.refinanciamientoId !== null && compra.refinanciamientoId !== undefined) return { clave: 'refinanciada', etiqueta: 'Refinanciada', tono: 'info', icono: 'merge_type' };
  if (esRefinanciada(compra.estado)) return { clave: 'refinanciada', etiqueta: 'Refinanciada', tono: 'info', icono: 'merge_type' };
  if (esPagada(compra.estado) || (cuotas.length > 0 && cuotas.every((c) => esPagada(c.estado)))) return { clave: 'pagada', etiqueta: 'Pagada', tono: 'success', icono: 'check_circle' };
  const e = normalizeSearchText(compra.estado ?? '');
  if (e.startsWith('cancel')) return { clave: 'cancelada', etiqueta: 'Cancelada', tono: 'neutral', icono: 'cancel' };
  if (e.startsWith('pendiente') || e === '') return { clave: 'en-curso', etiqueta: 'En curso', tono: 'warning', icono: 'schedule' };
  return { clave: 'otro', etiqueta: compra.estado ?? '—', tono: 'neutral', icono: 'info' };
}

// ───────── datos que faltan ─────────

export type CampoFaltante = 'tarjeta' | 'plastico' | 'descripcion' | 'responsables' | 'interes' | 'trm';

export interface DatoFaltante {
  campo: CampoFaltante;
  etiqueta: string;
}

/**
 * Lo que la persona aún puede completar de la compra (alimenta el aviso «Faltan X datos por completar» y resalta los campos vacíos).
 * Una compra unificada en un refinanciamiento ya no cobra por sí misma: no se le pide completar nada.
 */
export function datosFaltantesDeCompra(compra: ComprasCreditoMultimoneda): DatoFaltante[] {
  if (compra.refinanciamientoId !== null && compra.refinanciamientoId !== undefined) return [];
  const faltan: DatoFaltante[] = [];
  if (!compra.tarjeta) faltan.push({ campo: 'tarjeta', etiqueta: 'Tarjeta' });
  else if (!compra.plasticoUltimos4) faltan.push({ campo: 'plastico', etiqueta: 'Plástico' });
  if (!(compra.descripcion ?? '').trim()) faltan.push({ campo: 'descripcion', etiqueta: 'Descripción' });
  if (!(compra.porcentajePago && compra.porcentajePago > 0)) faltan.push({ campo: 'responsables', etiqueta: 'Responsables' });
  if (compra.interes === null || compra.interes === undefined) faltan.push({ campo: 'interes', etiqueta: 'Interés' });
  if (compra.monedaOriginal && compra.monedaOriginal !== 'COP' && compra.trmConfirmada === false) faltan.push({ campo: 'trm', etiqueta: 'TRM definitiva' });
  return faltan;
}

/** «Faltan 3 datos por completar» / «Falta 1 dato por completar». */
export function textoDatosFaltantes(cantidad: number): string {
  return cantidad === 1 ? 'Falta 1 dato por completar' : `Faltan ${cantidad} datos por completar`;
}

// ───────── avance de las cuotas ─────────

export interface ProgresoCuotas {
  total: number;
  pagadas: number;
  /** Cuota en la que va (la siguiente por pagar; `total` si ya terminó). */
  actual: number;
  /** 0–100 */
  porcentaje: number;
  /** Capital que falta por pagar. */
  saldoCapital: number;
  /** La próxima cuota por pagar (`null` si no queda ninguna). */
  proxima: CuotaDetalle | null;
  completa: boolean;
}

const estaPendiente = (c: CuotaDetalle): boolean => normalizeSearchText(c.estado ?? '') === 'pendiente' || (c.estado ?? '') === '';

export function progresoDeCuotas(cuotas: ReadonlyArray<CuotaDetalle>, totalDeclarado?: number | null): ProgresoCuotas {
  const total = cuotas.length > 0 ? cuotas.length : Math.max(0, totalDeclarado ?? 0);
  const pagadas = cuotas.filter((c) => esPagada(c.estado)).length;
  const pendientes = [...cuotas].filter(estaPendiente).sort((a, b) => (a.numeroCuota ?? 0) - (b.numeroCuota ?? 0));
  const saldoCapital = Math.round(pendientes.reduce((acc, c) => acc + (c.aporteCapital ?? 0) * 100, 0)) / 100;
  const completa = total > 0 && pagadas >= total;
  return {
    total,
    pagadas,
    actual: total === 0 ? 0 : completa ? total : Math.min(total, pagadas + 1),
    porcentaje: total === 0 ? 0 : Math.round((pagadas / total) * 1000) / 10,
    saldoCapital,
    proxima: pendientes[0] ?? null,
    completa,
  };
}

// ───────── Fase 1 (Iteración 3): Barra Apple Storage (>1 cuotas) y Resumen Pago Único (1 cuota) ─────────

export interface BarraAmortizacionSegmentada {
  capitalAmortizado: number;
  interesesPagados: number;
  capitalPendiente: number;
  interesesTotalesAcumulados: number;
  totalComprometido: number;
  porcentajeCapitalAmortizado: number;
  porcentajeInteresesPagados: number;
  porcentajeCapitalPendiente: number;
  cuotasPagadas: number;
  totalCuotas: number;
  proximaCuotaMonto: number;
}

export function calcularBarraAmortizacionSegmentada(
  cuotas: ReadonlyArray<CuotaDetalle>,
  valorCompra = 0,
  totalDeclarado = 0,
): BarraAmortizacionSegmentada {
  const pagadas = cuotas.filter((c) => esPagada(c.estado));
  const pendientes = cuotas
    .filter((c) => !esPagada(c.estado) && !esRefinanciada(c.estado))
    .sort((a, b) => (a.numeroCuota ?? 0) - (b.numeroCuota ?? 0));

  const capitalAmortizado = sumarMonedas(pagadas.map((c) => c.aporteCapital ?? 0));
  const interesesPagados = sumarMonedas(pagadas.map((c) => c.interesPagado ?? 0));
  const capitalPendiente =
    cuotas.length > 0
      ? sumarMonedas(pendientes.map((c) => c.aporteCapital ?? 0))
      : Math.max(0, valorCompra);
  const interesesTotalesAcumulados = sumarMonedas(cuotas.map((c) => c.interesPagado ?? 0));

  const totalBase = Math.max(1, sumarMonedas([capitalAmortizado, interesesPagados, capitalPendiente]));
  const pctAmortizado = Math.round((capitalAmortizado / totalBase) * 1000) / 10;
  const pctIntereses = Math.round((interesesPagados / totalBase) * 1000) / 10;
  const pctPendiente = Math.max(0, Math.round((100 - pctAmortizado - pctIntereses) * 10) / 10);

  return {
    capitalAmortizado,
    interesesPagados,
    capitalPendiente,
    interesesTotalesAcumulados,
    totalComprometido: sumarMonedas(cuotas.map((c) => c.pagoTotal ?? 0)) || valorCompra,
    porcentajeCapitalAmortizado: pctAmortizado,
    porcentajeInteresesPagados: pctIntereses,
    porcentajeCapitalPendiente: pctPendiente,
    cuotasPagadas: pagadas.length,
    totalCuotas: cuotas.length > 0 ? cuotas.length : Math.max(0, totalDeclarado),
    proximaCuotaMonto: pendientes[0]?.pagoTotal ?? 0,
  };
}

export interface ResumenPagoUnico {
  esUnaCuota: boolean;
  fechaTransaccion: Date | string | number | null;
  fechaEstimadaPagoExtracto: Date | string | number | null;
  costoFinanciero: number;
  textoCostoFinanciero: string;
  porcentajeSobreGastoMesTarjeta: number;
}

export function calcularResumenPagoUnico(
  compra: ComprasCreditoMultimoneda | undefined,
  cuotas: ReadonlyArray<CuotaDetalle>,
  porcentajeSobreGastoMesTarjeta = 100,
): ResumenPagoUnico {
  const numCuotas = compra?.numeroCuotas ?? (cuotas.length || 1);
  const esUnaCuota = numCuotas === 1;
  const fechaTransaccion = compra?.fechaCompra ?? null;
  const fechaEstimadaPagoExtracto = cuotas[0]?.fechaPago ?? compra?.fechaUltimaCuota ?? fechaTransaccion;
  const costoFinanciero = esUnaCuota ? 0 : sumarMonedas(cuotas.map((q) => q.interesPagado ?? 0));
  return {
    esUnaCuota,
    fechaTransaccion,
    fechaEstimadaPagoExtracto,
    costoFinanciero,
    textoCostoFinanciero: esUnaCuota ? '$0 — Sin intereses a 1 cuota' : `${costoFinanciero}`,
    porcentajeSobreGastoMesTarjeta,
  };
}

export function estadoRealDeCuota(
  cuota: CuotaDetalle,
  indice: number,
  cuotas: ReadonlyArray<CuotaDetalle>,
): { codigo: EstadoRealCuota; texto: string; tono: 'success' | 'warning' | 'info' | 'neutral' } {
  if (cuota.estadoReal) {
    switch (cuota.estadoReal) {
      case 'PAGADA':
        return { codigo: 'PAGADA', texto: 'Pagada', tono: 'success' };
      case 'ABSORBIDA_REFINANCIAMIENTO':
        return { codigo: 'ABSORBIDA_REFINANCIAMIENTO', texto: 'Refinanciada', tono: 'info' };
      case 'EN_EXTRACTO_ACTUAL':
        return { codigo: 'EN_EXTRACTO_ACTUAL', texto: 'En extracto actual', tono: 'warning' };
      default:
        return { codigo: 'FUTURA', texto: 'Futura', tono: 'neutral' };
    }
  }
  const e = (cuota.estado ?? '').toLowerCase();
  if (e.startsWith('pagad')) return { codigo: 'PAGADA', texto: 'Pagada', tono: 'success' };
  if (e.startsWith('refinanci') || e.startsWith('ajuste') || e.startsWith('absorbid')) {
    return { codigo: 'ABSORBIDA_REFINANCIAMIENTO', texto: 'Refinanciada', tono: 'info' };
  }
  const primeraPendienteIdx = cuotas.findIndex((c) => {
    const est = (c.estado ?? '').toLowerCase();
    return est === 'pendiente' || est === '';
  });
  if (e === 'pendiente' || e === '') {
    if (indice === primeraPendienteIdx || primeraPendienteIdx === -1) {
      return { codigo: 'EN_EXTRACTO_ACTUAL', texto: 'Pendiente · Extracto actual', tono: 'warning' };
    }
    return { codigo: 'FUTURA', texto: 'Pendiente · Futura', tono: 'warning' };
  }
  return { codigo: 'FUTURA', texto: cuota.estado ?? '—', tono: 'neutral' };
}

export function obtenerInicialesComercio(concepto?: string | null, comercioCanonico?: string | null): string {
  const base = (comercioCanonico || concepto || 'CC').trim();
  const partes = base.split(/[^a-zA-Z0-9ÁÉÍÓÚÑáéíóúñ]+/).filter((p) => p.length > 0);
  if (partes.length === 0) return 'CC';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0].charAt(0) + partes[1].charAt(0)).toUpperCase();
}
