/** Opción de un filtro de selección. `grupo` agrupa visualmente (p. ej. «Activas» / «Históricas»). */
export interface OpcionFiltro {
  valor: string | number;
  etiqueta: string;
  grupo?: string;
  /** Texto de apoyo (p. ej. «Crédito · *1927»). */
  detalle?: string;
}

export interface RangoFechas {
  desde: string | null;
  hasta: string | null;
}

export type PresetRangoFechas = '7D' | 'ESTE_MES' | '3M' | '6M' | 'YTD' | '1A';

/** Vista guardada en `localStorage` para reutilizar combinaciones de filtros con un clic (Iteración 2 — Fase 6). */
export interface VistaFiltroGuardada {
  id: string;
  nombre: string;
  estado: EstadoFiltros;
}

/** Calcula el rango `desde/hasta` (`YYYY-MM-DD`) de un preset rápido respecto a `hoy`. */
export function calcularRangoPreset(preset: PresetRangoFechas, hoy: Date = new Date()): RangoFechas {
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  const d = hoy.getDate();
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const hasta = fmt(hoy);
  switch (preset) {
    case '7D':
      return { desde: fmt(new Date(y, m, d - 6)), hasta };
    case 'ESTE_MES':
      return { desde: fmt(new Date(y, m, 1)), hasta: fmt(new Date(y, m + 1, 0)) };
    case '3M':
      return { desde: fmt(new Date(y, m - 2, 1)), hasta };
    case '6M':
      return { desde: fmt(new Date(y, m - 5, 1)), hasta };
    case 'YTD':
      return { desde: `${y}-01-01`, hasta };
    case '1A':
      return { desde: fmt(new Date(y - 1, m, d)), hasta };
  }
}

interface FiltroBase {
  id: string;
  etiqueta: string;
  /** Ícono de Material Icons. */
  icono?: string;
}

/** Elegir una o varias opciones de una lista (con buscador si hay muchas). */
export interface FiltroSeleccion extends FiltroBase {
  tipo: 'seleccion';
  opciones: OpcionFiltro[];
  multiple?: boolean;
  buscable?: boolean;
}

/** Desde / hasta. */
export interface FiltroFechas extends FiltroBase {
  tipo: 'fechas';
}

/** Casilla de sí/no. */
export interface FiltroInterruptor extends FiltroBase {
  tipo: 'interruptor';
}

/** Un número (p. ej. «Cuotas»). */
export interface FiltroNumero extends FiltroBase {
  tipo: 'numero';
  placeholder?: string;
}

export type DefinicionFiltro = FiltroSeleccion | FiltroFechas | FiltroInterruptor | FiltroNumero;

export type ValorFiltro = (string | number)[] | string | number | RangoFechas | boolean | null | undefined;

/** Todo lo que el usuario eligió en la barra. */
export interface EstadoFiltros {
  busqueda: string;
  /** Valor del segmento activo (el primero suele ser «todas»). */
  segmento: string;
  valores: Record<string, ValorFiltro>;
}

export interface SegmentoFiltro {
  valor: string;
  etiqueta: string;
  /** Cuántos registros tiene (opcional). */
  cantidad?: number;
}

export function estadoVacio(segmentoInicial = ''): EstadoFiltros {
  return { busqueda: '', segmento: segmentoInicial, valores: {} };
}

/** ¿Este valor cuenta como un filtro activo? */
export function tieneValor(def: DefinicionFiltro, v: ValorFiltro): boolean {
  switch (def.tipo) {
    case 'seleccion':
      return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '';
    case 'fechas': {
      const r = v as RangoFechas | null | undefined;
      return !!(r && (r.desde || r.hasta));
    }
    case 'interruptor':
      return v === true;
    case 'numero':
      return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  }
}

/** Texto corto del valor, para el chip («*1927 +1», «Oct 1 – Oct 31»…). */
export function resumenValor(def: DefinicionFiltro, v: ValorFiltro): string {
  if (!tieneValor(def, v)) return '';
  switch (def.tipo) {
    case 'seleccion': {
      const elegidos = (Array.isArray(v) ? v : [v as string | number]).map((x) => def.opciones.find((o) => o.valor === x)?.etiqueta ?? String(x));
      return elegidos.length > 1 ? `${elegidos[0]} +${elegidos.length - 1}` : elegidos[0];
    }
    case 'fechas': {
      const r = v as RangoFechas;
      return r.desde && r.hasta ? `${r.desde} → ${r.hasta}` : r.desde ? `Desde ${r.desde}` : `Hasta ${r.hasta}`;
    }
    case 'interruptor':
      return 'Sí';
    case 'numero':
      return String(v);
  }
}
