/**
 * Catálogos de los selectores (`GET /api/lookup`). Todos comparten la misma forma básica —`id` numérico y `nombre` texto, siempre
 * presentes— para que los formularios no tengan que adivinar nombres de campos (`id`/`_id`, `nombre`/`name`, snake_case/camelCase).
 */
export type TipoCatalogo = 'personas' | 'tarjetas' | 'cuentas' | 'categorias';

export const TIPOS_CATALOGO: ReadonlyArray<TipoCatalogo> = ['personas', 'tarjetas', 'cuentas', 'categorias'];

export interface ItemPersona {
  id: number;
  nombre: string;
  iniciales: string | null;
  color: string | null;
  /** La persona que usa la app (la que está enlazada al usuario). */
  esPropia: boolean;
  /** Tiene una cuenta de usuario enlazada (puede aprobar o rechazar sus propios préstamos). */
  tieneUsuario: boolean;
  email: string | null;
  celular: string | null;
}

export interface ItemPlasticoCatalogo {
  id: number;
  ultimos4: string;
  esActivo: boolean;
  vigenteDesde: string | null;
  vigenteHasta: string | null;
  /** ACTIVA · REEMPLAZADA · INACTIVA (sirve para agrupar «Activas» / «Históricas»). */
  estado?: 'ACTIVA' | 'INACTIVA' | 'REEMPLAZADA';
}

export interface ItemTarjeta {
  id: number;
  /** CREDITO | DEBITO: las compras a crédito, extractos y cupos solo admiten las de crédito. */
  tipo?: 'CREDITO' | 'DEBITO';
  cuentaId?: number | null;
  /** Nombre corto («Débito *3698»). */
  alias?: string | null;
  /** Producto «sin número». */
  esGenerica?: boolean;
  /** «American Express · Green» (nunca vacío). */
  nombre: string;
  franquicia: string | null;
  descripcion: string | null;
  /** Plástico vigente: el que se ofrece en las compras nuevas. */
  ultimos4Activo: string | null;
  /** «American Express ··1927». */
  etiqueta: string;
  plasticos: ItemPlasticoCatalogo[];
  tasaInteresCompra: number | null;
  diaCorte: number | null;
  diaLimitePago: number | null;
  cupoTotal: number | null;
  permiteDolares: boolean;
  /** Tarjeta prestada/de tercero (Fase 5). */
  esTitularExterno?: boolean;
  titularPersonaId?: number | null;
}

export interface ItemCuenta {
  id: number;
  nombre: string;
  tipoCuenta: string;
  bancoEntidad: string | null;
  /** Uno o varios grupos separados por coma ("3698,4278"). */
  ultimos4: string | null;
  moneda: string;
  saldoActual: number;
  activa: boolean;
  esPrincipal: boolean;
  /** Cuenta «sin número» que agrupa los avisos del banco que no traen cuenta. */
  esGenerica?: boolean;
}

export interface ItemCategoria {
  id: number;
  nombre: string;
  tipo: string;
  color: string | null;
  icono: string | null;
  delSistema: boolean;
}

export interface ItemTagCatalogo {
  slug: string;
  nombre: string;
  frecuencia: number;
  color: string;
}

export interface Catalogos {
  personas: ItemPersona[];
  tarjetas: ItemTarjeta[];
  cuentas: ItemCuenta[];
  categorias: ItemCategoria[];
}

export interface ItemDe {
  personas: ItemPersona;
  tarjetas: ItemTarjeta;
  cuentas: ItemCuenta;
  categorias: ItemCategoria;
}

/** Estado de un catálogo en memoria: se muestra lo que haya (aunque esté viejo) mientras se actualiza. */
export interface EstadoCatalogo<T> {
  datos: T[];
  cargando: boolean;
  error: string | null;
  /** `true` después de la primera respuesta buena (así `datos: []` se distingue de «aún no cargó»). */
  cargado: boolean;
  actualizadoEn: number | null;
}

/** Opción ya lista para pintar en `<app-select>`. */
export interface OpcionSelect<V = string | number> {
  valor: V;
  etiqueta: string;
  /** Texto secundario que se muestra a la derecha o debajo (ej. últimos 4 dígitos, banco, correo). */
  detalle?: string | null;
  /** Color de acento (punto o avatar). */
  color?: string | null;
  /** Texto extra por el que también se filtra al buscar. */
  busqueda?: string | null;
  deshabilitada?: boolean;
  /** Encabezado bajo el que se agrupa en la lista (p. ej. «Activas» / «Históricas / Reemplazadas»). Sin valor = sin grupo. */
  grupo?: string | null;
}
