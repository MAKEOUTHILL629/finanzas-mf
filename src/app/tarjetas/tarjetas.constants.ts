import { formatDateOnly } from '../shared/date-only.helper';
import { MotivoReemplazo, PlasticoTarjeta, Tarjeta } from '../modelos/tarjeta';

export const MOTIVOS_REEMPLAZO: ReadonlyArray<{ valor: MotivoReemplazo; etiqueta: string }> = [
  { valor: 'VENCIMIENTO', etiqueta: 'Vencimiento' },
  { valor: 'PERDIDA', etiqueta: 'Pérdida' },
  { valor: 'ROBO', etiqueta: 'Robo' },
  { valor: 'DETERIORO', etiqueta: 'Deterioro' },
  { valor: 'FRAUDE', etiqueta: 'Fraude o bloqueo' },
  { valor: 'CAMBIO_PRODUCTO', etiqueta: 'Cambio de producto' },
  { valor: 'OTRO', etiqueta: 'Otro motivo' },
];

export function etiquetaMotivo(motivo: string | null | undefined): string {
  return MOTIVOS_REEMPLAZO.find((m) => m.valor === motivo)?.etiqueta ?? '';
}

/** `1927` → `··1927` (solo para mostrar). */
export function terminacion(ultimos4: string | null | undefined): string {
  return ultimos4 ? `··${ultimos4}` : '';
}

/** Nombre de la línea de crédito: «American Express · Oro» o «Tarjeta #3». */
export function nombreTarjeta(t: { id?: number; franquicia?: string | null; descripcion?: string | null } | null | undefined): string {
  if (!t) return '';
  return [t.franquicia, t.descripcion].filter((x) => !!x).join(' · ') || `Tarjeta #${t.id}`;
}

/** Lo que se ofrece en los selectores de compras nuevas: la franquicia y el plástico ACTIVO («American Express ··1927»). */
export function etiquetaTarjetaActiva(t: Tarjeta): string {
  const base = t.franquicia || nombreTarjeta(t);
  const activo = t.ultimos4Activo ?? t.plasticoActivo?.ultimos4 ?? null;
  return activo ? `${base} ${terminacion(activo)}` : base;
}

/** Plásticos archivados (anteriores) de una tarjeta, del más reciente al más antiguo. */
export function plasticosArchivados(t: Tarjeta): PlasticoTarjeta[] {
  return (t.plasticos ?? []).filter((p) => !p.esActivo);
}

/** «Desde 27/12/2024», «Hasta 16/03/2024», «27/12/2024 – 16/03/2024» o «Vigencia sin registrar». */
export function vigenciaLegible(p: Pick<PlasticoTarjeta, 'vigenteDesde' | 'vigenteHasta' | 'esActivo'>): string {
  const f = (v: string) => formatDateOnly(v, 'dd/MM/yyyy');
  if (p.vigenteDesde && p.vigenteHasta) return `${f(p.vigenteDesde)} – ${f(p.vigenteHasta)}`;
  if (p.vigenteDesde) return p.esActivo ? `Desde ${f(p.vigenteDesde)}` : `Desde ${f(p.vigenteDesde)} · sin cierre`;
  if (p.vigenteHasta) return `Hasta ${f(p.vigenteHasta)}`;
  return p.esActivo ? 'Vigente' : 'Vigencia sin registrar';
}

const dia = (s: string | null): number => (s ? Date.parse(`${s.slice(0, 10)}T00:00:00Z`) : Number.NEGATIVE_INFINITY);

/**
 * Plástico con el que se pagó una compra hecha en `fecha` (`yyyy-MM-dd`): el de inicio más reciente que no sea posterior;
 * el de inicio desconocido cuenta como el más antiguo. Igual que el backend (`plasticoParaFecha`).
 */
export function plasticoParaFecha(plasticos: PlasticoTarjeta[], fecha: string | null): PlasticoTarjeta | null {
  if (plasticos.length === 0) return null;
  if (plasticos.length === 1) return plasticos[0];
  const ordenados = [...plasticos].sort((a, b) => dia(a.vigenteDesde) - dia(b.vigenteDesde) || a.id - b.id);
  if (!fecha) return ordenados.find((p) => p.esActivo) ?? ordenados[ordenados.length - 1];
  const t = dia(fecha);
  const vigentes = ordenados.filter((p) => dia(p.vigenteDesde) <= t);
  return vigentes.length > 0 ? vigentes[vigentes.length - 1] : ordenados[0];
}

/**
 * Al registrar una compra solo se ofrece el plástico ACTIVO. Si la compra es retroactiva (anterior al inicio del plástico activo)
 * y la tarjeta tiene plásticos anteriores, se pueden elegir también los archivados.
 */
export function esCompraRetroactiva(t: Tarjeta | null | undefined, fecha: string | null): boolean {
  if (!t || !fecha) return false;
  const activo = t.plasticoActivo ?? (t.plasticos ?? []).find((p) => p.esActivo);
  if (!activo?.vigenteDesde || plasticosArchivados(t).length === 0) return false;
  return dia(fecha) < dia(activo.vigenteDesde);
}
