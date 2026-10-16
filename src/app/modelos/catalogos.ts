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
}

export interface ItemTarjeta {
  id: number;
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
}

export interface ItemCategoria {
  id: number;
  nombre: string;
  tipo: string;
  color: string | null;
  icono: string | null;
  delSistema: boolean;
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
  /** Hay una petición en curso (los `datos` anteriores, si existen, siguen visibles). */
  cargando: boolean;
  /** Mensaje del último fallo; `null` si la última carga salió bien. */
  error: string | null;
  /** Ya se cargó al menos una vez. */
  cargado: boolean;
  actualizadoEn: number | null;
}

export interface OpcionSelect {
  valor: number | string;
  etiqueta: string;
  /** Texto secundario (saldo, vigencia…) que algunos selectores muestran junto a la etiqueta. */
  detalle?: string;
  deshabilitada?: boolean;
}
