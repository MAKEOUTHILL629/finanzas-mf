import { EstadoFiltros } from '../../shared/ui/filter-bar/filter-bar.types';
import { normalizeSearchText } from '../../shared/utils';
import { EstadoProducto, ProductoLineaTiempo, TipoProducto } from '../../modelos/linea-tiempo';

const DIA_MS = 86_400_000;

/** `yyyy-MM-dd` → milisegundos UTC (null si no es una fecha). */
export function aMs(fecha: string | null | undefined): number | null {
  if (!fecha) return null;
  const t = Date.parse(`${fecha.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(t) ? t : null;
}

/** Posición (0–100 %) de una fecha dentro de la escala; se recorta a los extremos. */
export function posicionEnEscala(fecha: string | null | undefined, desde: string, hasta: string): number {
  const d = aMs(desde) ?? 0;
  const h = aMs(hasta) ?? d + DIA_MS;
  const t = aMs(fecha);
  if (t === null || h <= d) return 0;
  return Math.min(100, Math.max(0, ((t - d) / (h - d)) * 100));
}

export interface BarraProducto {
  /** % desde el inicio de la escala. */
  izquierda: number;
  /** % de ancho (nunca menos de 0,6 % para que un uso de un solo día se vea). */
  ancho: number;
  /** Sigue en uso: la barra llega hasta hoy y se dibuja con un degradado que se desvanece. */
  abierta: boolean;
  /** No hay fecha de inicio conocida. */
  sinFechas: boolean;
}

/** Barra de un producto sobre la escala; sin inicio conocido no se dibuja. */
export function barraDe(p: Pick<ProductoLineaTiempo, 'desde' | 'hasta'>, desde: string, hasta: string): BarraProducto {
  if (!p.desde) return { izquierda: 0, ancho: 0, abierta: false, sinFechas: true };
  const ini = posicionEnEscala(p.desde, desde, hasta);
  const fin = p.hasta ? posicionEnEscala(p.hasta, desde, hasta) : 100;
  return { izquierda: ini, ancho: Math.max(0.6, fin - ini), abierta: !p.hasta, sinFechas: false };
}

export interface MarcaAnio {
  anio: number;
  /** % desde el inicio de la escala. */
  posicion: number;
}

/** Una marca por cada primero de enero que cae dentro de la escala (más la del año de inicio si empieza en enero). */
export function marcasDeAnio(desde: string, hasta: string): MarcaAnio[] {
  const d = aMs(desde);
  const h = aMs(hasta);
  if (d === null || h === null || h <= d) return [];
  const marcas: MarcaAnio[] = [];
  for (let anio = new Date(d).getUTCFullYear(); anio <= new Date(h).getUTCFullYear(); anio++) {
    const t = Date.UTC(anio, 0, 1);
    if (t >= d && t <= h) marcas.push({ anio, posicion: ((t - d) / (h - d)) * 100 });
  }
  return marcas;
}

/** «3 años y 2 meses», «5 meses», «12 días». */
export function duracionLegible(desde: string | null, hasta: string | null, hoy: string): string {
  const d = aMs(desde);
  if (d === null) return '';
  const h = aMs(hasta) ?? aMs(hoy) ?? d;
  const dias = Math.max(0, Math.round((h - d) / DIA_MS));
  if (dias < 31) return `${dias === 1 ? '1 día' : `${dias} días`}`;
  const meses = Math.round(dias / 30.44);
  if (meses < 12) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  return `${anios} ${anios === 1 ? 'año' : 'años'}${resto > 0 ? ` y ${resto} ${resto === 1 ? 'mes' : 'meses'}` : ''}`;
}

/** Monto abreviado para dentro de la barra: $957 mil · $38,4 M · $1,2 mil M. */
export function montoCorto(monto: number): string {
  const abs = Math.abs(monto);
  const fmt = (v: number) => v.toLocaleString('es-CO', { maximumFractionDigits: v < 10 ? 1 : 0 });
  if (abs >= 1e9) return `$${fmt(monto / 1e9)} mil M`;
  if (abs >= 1e6) return `$${fmt(monto / 1e6)} M`;
  if (abs >= 1e3) return `$${fmt(monto / 1e3)} mil`;
  return `$${fmt(monto)}`;
}

export const SEGMENTOS_PRODUCTOS = ['todos', 'CREDITO', 'DEBITO', 'CUENTA'] as const;
export type SegmentoProductos = (typeof SEGMENTOS_PRODUCTOS)[number];

export const ETIQUETA_TIPO_PRODUCTO: Record<TipoProducto, string> = { CREDITO: 'Crédito', DEBITO: 'Débito', CUENTA: 'Cuentas' };
export const ETIQUETA_ESTADO_PRODUCTO: Record<EstadoProducto, string> = { ACTIVA: 'Activa', REEMPLAZADA: 'Reemplazada', INACTIVA: 'Histórica' };

/** Aplica la barra de filtros a la línea de tiempo: tipo (segmento), estado (activos/históricos) y texto. */
export function filtrarProductos(productos: ProductoLineaTiempo[], e: EstadoFiltros): ProductoLineaTiempo[] {
  const palabras = normalizeSearchText(e.busqueda ?? '').split(/\s+/).filter(Boolean);
  const segmento = (e.segmento || 'todos') as SegmentoProductos;
  const estado = e.valores['estado'];
  return productos.filter((p) => {
    if (segmento !== 'todos' && p.tipo !== segmento) return false;
    if (estado === 'ACTIVA' && p.estado !== 'ACTIVA') return false;
    if (estado === 'HISTORICA' && p.estado === 'ACTIVA') return false;
    if (palabras.length === 0) return true;
    const texto = normalizeSearchText([p.etiqueta, p.detalle, p.ultimos4, ETIQUETA_TIPO_PRODUCTO[p.tipo], ETIQUETA_ESTADO_PRODUCTO[p.estado], p.generica ? 'sin numero generica' : ''].join(' '));
    return palabras.every((w) => texto.includes(w));
  });
}

export function conteoProductos(productos: ProductoLineaTiempo[], e: EstadoFiltros): Record<SegmentoProductos, number> {
  const base = filtrarProductos(productos, { ...e, segmento: 'todos' });
  return {
    todos: base.length,
    CREDITO: base.filter((p) => p.tipo === 'CREDITO').length,
    DEBITO: base.filter((p) => p.tipo === 'DEBITO').length,
    CUENTA: base.filter((p) => p.tipo === 'CUENTA').length,
  };
}

/** Lo que se lee al enfocar o pasar sobre una barra (también es el texto para lectores de pantalla). */
export function descripcionProducto(p: ProductoLineaTiempo, hoy: string): string {
  const periodo = p.desde ? `${p.desde} → ${p.hasta ?? 'hoy'} (${duracionLegible(p.desde, p.hasta, hoy)})` : 'sin fechas registradas';
  const mov = p.movimientos === 0 ? 'sin movimientos' : `${p.movimientos} ${p.movimientos === 1 ? 'movimiento' : 'movimientos'} · ${montoCorto(p.monto)}`;
  return `${p.etiqueta} · ${ETIQUETA_ESTADO_PRODUCTO[p.estado]} · ${periodo} · ${mov}`;
}
