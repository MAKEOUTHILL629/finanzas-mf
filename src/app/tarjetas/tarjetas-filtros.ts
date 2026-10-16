import { Tarjeta } from '../modelos/tarjeta';
import { EstadoFiltros } from '../shared/ui/filter-bar/filter-bar.types';
import { normalizeSearchText } from '../shared/utils';
import { ETIQUETA_TIPO_TARJETA, nombreTarjeta, tipoDe } from './tarjetas.constants';

export const SEGMENTOS_TARJETAS = ['todas', 'credito', 'debito'] as const;
export type SegmentoTarjetas = (typeof SEGMENTOS_TARJETAS)[number];

export interface ContextoTarjetas {
  nombreCuenta(id: number | null | undefined): string;
}

/**
 * «Activa» si tiene un plástico vigente, es el producto «sin número» o todavía no tiene plásticos registrados (una tarjeta antigua cuyos
 * dígitos aún no se cargaron no es «histórica»). Solo es histórica la que tiene plásticos y ninguno está vigente.
 */
export function estaActiva(t: Tarjeta): boolean {
  const plasticos = t.plasticos ?? [];
  return !!t.esGenerica || plasticos.length === 0 || plasticos.some((p) => p.esActivo);
}

/** Todo el texto por el que se puede buscar una tarjeta (nombre, alias, tipo, dígitos de todos sus plásticos, cuenta y notas de los plásticos). */
export function textoBuscableTarjeta(t: Tarjeta, ctx: ContextoTarjetas): string {
  return normalizeSearchText(
    [
      nombreTarjeta(t),
      t.franquicia,
      t.descripcion,
      t.alias,
      ETIQUETA_TIPO_TARJETA[tipoDe(t)],
      t.ultimos4Digitos,
      ...(t.plasticos ?? []).flatMap((p) => [p.ultimos4, p.notas]),
      ctx.nombreCuenta(t.cuentaId),
      t.esGenerica ? 'sin número generica' : '',
    ].join(' ')
  );
}

/** Aplica la barra de filtros: segmento (tipo), estado (activas/históricas), cuenta y texto. */
export function filtrarTarjetas(tarjetas: Tarjeta[], e: EstadoFiltros, ctx: ContextoTarjetas): Tarjeta[] {
  const palabras = normalizeSearchText(e.busqueda ?? '').split(/\s+/).filter(Boolean);
  const segmento = (e.segmento || 'todas') as SegmentoTarjetas;
  const estado = e.valores['estado'];
  const cuentas = Array.isArray(e.valores['cuentas']) ? (e.valores['cuentas'] as Array<string | number>).map(Number) : [];
  return tarjetas.filter((t) => {
    if (segmento === 'credito' && tipoDe(t) !== 'CREDITO') return false;
    if (segmento === 'debito' && tipoDe(t) !== 'DEBITO') return false;
    if (estado === 'ACTIVA' && !estaActiva(t)) return false;
    if (estado === 'HISTORICA' && estaActiva(t)) return false;
    if (cuentas.length > 0 && !(t.cuentaId !== null && t.cuentaId !== undefined && cuentas.includes(t.cuentaId))) return false;
    if (palabras.length > 0) {
      const texto = textoBuscableTarjeta(t, ctx);
      if (!palabras.every((p) => texto.includes(p))) return false;
    }
    return true;
  });
}

/** Cuántas tarjetas hay por segmento con el resto de filtros aplicados. */
export function conteoTarjetas(tarjetas: Tarjeta[], e: EstadoFiltros, ctx: ContextoTarjetas): Record<SegmentoTarjetas, number> {
  const base = filtrarTarjetas(tarjetas, { ...e, segmento: 'todas' }, ctx);
  return { todas: base.length, credito: base.filter((t) => tipoDe(t) === 'CREDITO').length, debito: base.filter((t) => tipoDe(t) === 'DEBITO').length };
}
