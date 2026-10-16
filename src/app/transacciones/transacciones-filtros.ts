import { Transaccion } from '../modelos/erp';
import { EstadoFiltros, RangoFechas } from '../shared/ui/filter-bar/filter-bar.types';
import { normalizeSearchText } from '../shared/utils';
import { etiquetaEstadoTransaccion, reglasDeTipo } from './transacciones.constants';

/** Lo que hace falta de afuera para buscar y filtrar (nombres de cuentas y categorías). */
export interface ContextoTransacciones {
  nombreCuenta(id: number | null): string;
  nombreCategoria(id: number | null): string;
}

export const SEGMENTOS_TX = ['todas', 'confirmadas', 'revision', 'anuladas'] as const;
export type SegmentoTx = (typeof SEGMENTOS_TX)[number];

export function segmentoDeTx(t: Pick<Transaccion, 'estado'>): SegmentoTx | null {
  switch (t.estado) {
    case 'CONFIRMADO':
      return 'confirmadas';
    case 'PENDIENTE_REVISION':
      return 'revision';
    case 'ANULADO':
      return 'anuladas';
    default:
      return null;
  }
}

/** Todo el texto por el que se puede buscar una transacción (concepto, categoría, cuentas, tipo, estado, notas, monto). */
export function textoBuscableTx(t: Transaccion, ctx: ContextoTransacciones): string {
  return normalizeSearchText(
    [
      t.concepto,
      ctx.nombreCategoria(t.categoria_id),
      ctx.nombreCuenta(t.cuenta_origen_id),
      ctx.nombreCuenta(t.cuenta_destino_id),
      reglasDeTipo(t.tipo_transaccion).etiqueta,
      etiquetaEstadoTransaccion(t.estado),
      t.origen_registro === 'EMAIL_AUTO' ? 'correo' : '',
      t.notas,
      t.monto_cop,
      t.monto_original,
      t.moneda_original,
    ].join(' ')
  );
}

function dentroDelRango(fechaIso: string, rango: RangoFechas | null | undefined): boolean {
  if (!rango || (!rango.desde && !rango.hasta)) return true;
  const t = new Date(fechaIso).getTime();
  if (!Number.isFinite(t)) return false;
  // El día se mide en hora de Bogotá (UTC−5), como el resto de la aplicación.
  const dia = new Date(t - 5 * 3_600_000).toISOString().slice(0, 10);
  if (rango.desde && dia < rango.desde) return false;
  if (rango.hasta && dia > rango.hasta) return false;
  return true;
}

const numeros = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number) : []);

/** Aplica la barra de filtros a las transacciones ya cargadas del periodo. */
export function filtrarTransacciones(items: Transaccion[], estado: EstadoFiltros, ctx: ContextoTransacciones): Transaccion[] {
  const palabras = normalizeSearchText(estado.busqueda ?? '').split(/\s+/).filter(Boolean);
  const v = estado.valores;
  const tipos = Array.isArray(v['tipos']) ? (v['tipos'] as string[]) : [];
  const cuentas = numeros(v['cuentas']);
  const categorias = numeros(v['categorias']);
  const origenes = Array.isArray(v['origen']) ? (v['origen'] as string[]) : [];
  const segmento = (estado.segmento || 'todas') as SegmentoTx;

  return items.filter((t) => {
    if (segmento !== 'todas' && segmentoDeTx(t) !== segmento) return false;
    if (tipos.length > 0 && !tipos.includes(t.tipo_transaccion)) return false;
    if (cuentas.length > 0 && !cuentas.some((c) => c === t.cuenta_origen_id || c === t.cuenta_destino_id)) return false;
    if (categorias.length > 0 && !(t.categoria_id !== null && categorias.includes(t.categoria_id))) return false;
    if (origenes.length > 0 && !origenes.includes(t.origen_registro ?? '')) return false;
    if (!dentroDelRango(t.fecha_transaccion, v['fechas'] as RangoFechas | undefined)) return false;
    if (palabras.length > 0) {
      const texto = textoBuscableTx(t, ctx);
      if (!palabras.every((p) => texto.includes(p))) return false;
    }
    return true;
  });
}

/** Cuántas transacciones caen en cada segmento con el resto de filtros aplicados. */
export function conteoPorSegmentoTx(items: Transaccion[], estado: EstadoFiltros, ctx: ContextoTransacciones): Record<SegmentoTx, number> {
  const sinSegmento = filtrarTransacciones(items, { ...estado, segmento: 'todas' }, ctx);
  const cuenta: Record<SegmentoTx, number> = { todas: sinSegmento.length, confirmadas: 0, revision: 0, anuladas: 0 };
  for (const t of sinSegmento) {
    const s = segmentoDeTx(t);
    if (s) cuenta[s]++;
  }
  return cuenta;
}
