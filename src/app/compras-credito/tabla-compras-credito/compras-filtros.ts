import { ComprasCredito } from '../../modelos/compras-credito';
import { EstadoFiltros, RangoFechas } from '../../shared/ui/filter-bar/filter-bar.types';
import { normalizeSearchText } from '../../shared/utils';

/** Lo que hace falta de afuera para buscar y filtrar (nombres de tarjetas y personas). */
export interface ContextoCompras {
  nombreTarjeta(id: number | null | undefined): string;
  nombrePersona(id: number): string;
}

export const SEGMENTOS_COMPRAS = ['todas', 'pendientes', 'pagadas', 'refinanciadas'] as const;
export type SegmentoCompras = (typeof SEGMENTOS_COMPRAS)[number];

/** Normaliza el estado que guarda la base («Pendiente», «Pagado», «Refinanciada»…) a un segmento. */
export function segmentoDe(compra: Pick<ComprasCredito, 'estado'>): SegmentoCompras | null {
  const e = normalizeSearchText(compra.estado ?? '');
  if (e.startsWith('refinanci') || e.includes('pagada por refinanc')) return 'refinanciadas';
  if (e.startsWith('pendiente')) return 'pendientes';
  if (e.startsWith('pagad')) return 'pagadas';
  return null;
}

export function idsResponsables(compra: Pick<ComprasCredito, 'responsables'>): number[] {
  return (compra.responsables ?? '')
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

/** Todo el texto por el que se puede buscar una compra (concepto, descripción, estado, tarjeta, personas, monto, fecha). */
export function textoBuscable(c: ComprasCredito, ctx: ContextoCompras): string {
  const personas = idsResponsables(c).map((id) => ctx.nombrePersona(id));
  return normalizeSearchText([c.concepto, c.descripcion, c.estado, ctx.nombreTarjeta(c.tarjeta), ...personas, c.valorCompra, c.pagoMensual, c.numeroCuotas ? `${c.numeroCuotas} cuotas` : ''].join(' '));
}

const dia = (v: Date | string | number | undefined | null): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
};

function dentroDelRango(valor: Date | string | number | undefined | null, rango: RangoFechas | null | undefined): boolean {
  if (!rango || (!rango.desde && !rango.hasta)) return true;
  const t = dia(valor);
  if (t === null) return false;
  if (rango.desde && t < new Date(`${rango.desde}T00:00:00Z`).getTime()) return false;
  // «hasta» incluye todo ese día
  if (rango.hasta && t >= new Date(`${rango.hasta}T00:00:00Z`).getTime() + 86_400_000) return false;
  return true;
}

/** Aplica la barra de filtros a la lista (todo en memoria: son cientos de compras). */
export function filtrarCompras(compras: ComprasCredito[], estado: EstadoFiltros, ctx: ContextoCompras): ComprasCredito[] {
  const q = normalizeSearchText(estado.busqueda ?? '');
  const palabras = q ? q.split(/\s+/).filter(Boolean) : [];
  const v = estado.valores;
  const personas = (v['personas'] as (string | number)[] | undefined)?.map(Number) ?? [];
  const tarjetas = (v['tarjetas'] as (string | number)[] | undefined)?.map(Number) ?? [];
  const cuotas = v['cuotas'] === undefined || v['cuotas'] === null || v['cuotas'] === '' ? null : Number(v['cuotas']);
  const segmento = (estado.segmento || 'todas') as SegmentoCompras;

  return compras.filter((c) => {
    if (segmento !== 'todas' && segmentoDe(c) !== segmento) return false;
    if (palabras.length > 0) {
      const texto = textoBuscable(c, ctx);
      if (!palabras.every((p) => texto.includes(p))) return false;
    }
    if (tarjetas.length > 0 && !(c.tarjeta !== undefined && tarjetas.includes(c.tarjeta))) return false;
    if (personas.length > 0 && !idsResponsables(c).some((id) => personas.includes(id))) return false;
    if (cuotas !== null && c.numeroCuotas !== cuotas) return false;
    if (!dentroDelRango(c.fechaCompra, v['fechaCompra'] as RangoFechas | undefined)) return false;
    if (!dentroDelRango(c.fechaUltimaCuota, v['fechaUltimaCuota'] as RangoFechas | undefined)) return false;
    if (v['sinResponsables'] === true && (c.porcentajePago ?? 0) >= 100) return false;
    return true;
  });
}

/** Cuántas compras caería en cada segmento con el resto de filtros aplicados (para los contadores del control segmentado). */
export function conteoPorSegmento(compras: ComprasCredito[], estado: EstadoFiltros, ctx: ContextoCompras): Record<SegmentoCompras, number> {
  const sinSegmento = filtrarCompras(compras, { ...estado, segmento: 'todas' }, ctx);
  const cuenta: Record<SegmentoCompras, number> = { todas: sinSegmento.length, pendientes: 0, pagadas: 0, refinanciadas: 0 };
  for (const c of sinSegmento) {
    const s = segmentoDe(c);
    if (s) cuenta[s]++;
  }
  return cuenta;
}
