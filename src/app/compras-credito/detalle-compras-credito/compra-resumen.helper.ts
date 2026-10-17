import { ComprasCreditoMultimoneda, CuotaDetalle } from '../../modelos/compras-credito';
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
  return e.startsWith('refinanci') || e.startsWith('ajuste');
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
