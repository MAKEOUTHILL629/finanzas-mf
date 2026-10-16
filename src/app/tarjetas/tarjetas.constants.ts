import { formatDateOnly } from '../shared/date-only.helper';
import { EstadoPlastico, MotivoReemplazo, PlasticoTarjeta, TipoTarjeta } from '../modelos/tarjeta';

/** Lo mínimo que se necesita de un plástico: lo comparten `PlasticoTarjeta` (API de tarjetas) y `ItemPlasticoCatalogo` (selectores). */
export type PlasticoBasico = Pick<PlasticoTarjeta, 'id' | 'ultimos4' | 'esActivo' | 'vigenteDesde' | 'vigenteHasta'>;

/** Una tarjeta con sus plásticos, venga de `/tarjetas` o del catálogo `/lookup`. */
export interface TarjetaConPlasticos {
  id?: number;
  franquicia?: string | null;
  descripcion?: string | null;
  ultimos4Activo?: string | null;
  plasticoActivo?: PlasticoBasico | null;
  plasticos?: PlasticoBasico[];
}

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

/** Nombre de la tarjeta: el alias si lo tiene («Débito *3698») o «American Express · Oro» / «Tarjeta #3». */
export function nombreTarjeta(t: { id?: number; franquicia?: string | null; descripcion?: string | null; alias?: string | null } | null | undefined): string {
  if (!t) return '';
  return t.alias?.trim() || [t.franquicia, t.descripcion].filter((x) => !!x).join(' · ') || `Tarjeta #${t.id}`;
}

export const ETIQUETA_TIPO_TARJETA: Record<TipoTarjeta, string> = { CREDITO: 'Crédito', DEBITO: 'Débito' };

/** Tipo de una tarjeta; las que no lo declaran son de crédito (como todas las de antes). */
export const tipoDe = (t: { tipo?: TipoTarjeta } | null | undefined): TipoTarjeta => t?.tipo ?? 'CREDITO';

export const esDebito = (t: { tipo?: TipoTarjeta } | null | undefined): boolean => tipoDe(t) === 'DEBITO';

/** «Activa» · «Reemplazada» · «Histórica» (un plástico archivado sin continuidad). Sin estado calculado se deduce de `esActivo`. */
export function etiquetaEstadoPlastico(p: { estado?: EstadoPlastico; esActivo: boolean }): string {
  const estado: EstadoPlastico = p.estado ?? (p.esActivo ? 'ACTIVA' : 'INACTIVA');
  return estado === 'ACTIVA' ? 'Activa' : estado === 'REEMPLAZADA' ? 'Reemplazada' : 'Histórica';
}

export function tonoEstadoPlastico(p: { estado?: EstadoPlastico; esActivo: boolean }): 'success' | 'neutral' | 'info' {
  const estado: EstadoPlastico = p.estado ?? (p.esActivo ? 'ACTIVA' : 'INACTIVA');
  return estado === 'ACTIVA' ? 'success' : estado === 'REEMPLAZADA' ? 'info' : 'neutral';
}

/** Lo que se ofrece en los selectores de compras nuevas: la franquicia y el plástico ACTIVO («American Express ··1927»). */
export function etiquetaTarjetaActiva(t: TarjetaConPlasticos): string {
  const base = t.franquicia || nombreTarjeta(t);
  const activo = t.ultimos4Activo ?? t.plasticoActivo?.ultimos4 ?? null;
  return activo ? `${base} ${terminacion(activo)}` : base;
}

/** Plásticos archivados (anteriores) de una tarjeta, del más reciente al más antiguo. */
export function plasticosArchivados<P extends PlasticoBasico>(t: { plasticos?: P[] }): P[] {
  return (t.plasticos ?? []).filter((p) => !p.esActivo);
}

/** «Desde 27/12/2024», «Hasta 16/03/2024», «27/12/2024 – 16/03/2024» o «Vigencia sin registrar». */
export function vigenciaLegible(p: Pick<PlasticoBasico, 'vigenteDesde' | 'vigenteHasta' | 'esActivo'>): string {
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
export function plasticoParaFecha<P extends PlasticoBasico>(plasticos: P[], fecha: string | null): P | null {
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
export function esCompraRetroactiva(t: TarjetaConPlasticos | null | undefined, fecha: string | null): boolean {
  if (!t || !fecha) return false;
  const activo = t.plasticoActivo ?? (t.plasticos ?? []).find((p) => p.esActivo);
  if (!activo?.vigenteDesde || plasticosArchivados(t).length === 0) return false;
  return dia(fecha) < dia(activo.vigenteDesde);
}
