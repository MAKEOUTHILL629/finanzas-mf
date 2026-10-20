/**
 * Préstamos (con aprobaciones) y cortes de cobro tal como los devuelve el backend NestJS.
 *
 * `GET /api/prestamos` y `GET /api/prestamos/:id` conservan el contrato legacy (camelCase; las fechas de calendario van
 * como epoch-ms 00:00 UTC y las de aprobación como ISO) y añaden los campos del esquema Supabase. Los cortes de cobro,
 * en cambio, son filas crudas (snake_case, fechas ISO).
 */
import { Periodo } from './erp';
import { AprobacionPrestamo, EstadoAprobacion } from './prestamos';

export type EstadoPrestamo = 'Pendiente' | 'Pagado' | 'Anulado';
export type DireccionPrestamo = 'POR_COBRAR' | 'POR_PAGAR';
export type MetodoPrestamo = 'Nequi' | 'Fisico' | 'Pago Fernando' | 'Prestamo Fernando' | 'Domicilio' | 'Otros';
export type EstadoCorte = 'PASADO' | 'ACTIVO' | 'FUTURO';

export interface PrestamoDetalle {
  id: number;
  fechaCreacion: number | null;
  valorPrestado: number;
  concepto: string;
  /** epoch-ms 00:00 UTC */
  fechaCobro: number | null;
  responsable: number;
  estado: string;
  comentarios: string | null;
  direccionPrestamo: DireccionPrestamo | null;
  saldoPendiente: number | null;
  esRecurrenteMensual: boolean | null;
  cuotaMensualAcordada: number | null;
  fechaPrestamo: number | null;
  metodo: MetodoPrestamo | string | null;
  corteId: number | null;
  creadoPorPersonaId: number | null;
  origenCruceAporteId: number | null;
  aprobaciones: AprobacionPrestamo[];
  /** Fase 6 (POR_PAGAR). */
  fechaCompromisoPago?: number | null;
  cuentaDestinoTercero?: string | null;
  tokenConsultaPublica?: string | null;
}

export interface FiltroPrestamos {
  estado?: EstadoPrestamo;
  direccion?: DireccionPrestamo;
  corteId?: number;
  responsableId?: number;
}

export interface CrearPrestamo {
  valorPrestado: number | string;
  concepto: string;
  /** `yyyy-MM-dd` */
  fechaCobro: string;
  responsable: number;
  estado: string;
  comentarios: string;
  direccionPrestamo?: DireccionPrestamo;
  fechaPrestamo?: string;
  metodo?: MetodoPrestamo;
  corteId?: number;
  esRecurrenteMensual?: boolean;
  cuotaMensualAcordada?: number | string;
  fechaCompromisoPago?: string;
  cuentaDestinoTercero?: string;
}

/** Al pasar a 'Pagado' el Trigger 4 abona el saldo en el sub-ledger y después el saldo queda en 0. */
export interface ActualizarPrestamo {
  estado?: EstadoPrestamo;
  saldoPendiente?: number | string;
  comentarios?: string;
  metodo?: MetodoPrestamo;
  corteId?: number;
  fechaCobro?: string;
  fechaCompromisoPago?: string;
  cuentaDestinoTercero?: string;
}

export interface ResolverAprobacion {
  estado: Exclude<EstadoAprobacion, 'Pendiente'>;
  comentarios?: string;
}

export interface CorteCobro {
  id: number;
  owner_user_id: number;
  concepto: string;
  /** ISO `…T00:00:00.000Z` (columna date) */
  fecha_inicio: string;
  fecha_final: string;
  estado: EstadoCorte | null;
  created_at: string | null;
}

export interface CrearCorteCobro {
  concepto: string;
  /** `yyyy-MM-dd` */
  fechaInicio: string;
  fechaFinal: string;
  estado?: EstadoCorte;
}

export type ActualizarCorteCobro = Partial<CrearCorteCobro>;

export type { AprobacionPrestamo, EstadoAprobacion, Periodo };
