// case class Prestamo(id: Int, fechaCreacion: Date, valorPrestado: Float, concepto: String, fechaCobro:Date, responsable: Int, estado: String, comentarios: String)

export class Prestamo {
  id?: number;
  fechaCreacion?: Date;
  valorPrestado?: number;
  concepto?: string;
  fechaCobro?: Date;
  responsable?: number;
  estado?: string;
  comentarios?: string;

  // Esquema Supabase (el backend NestJS los devuelve además del contrato legacy)
  direccionPrestamo?: 'POR_COBRAR' | 'POR_PAGAR';
  saldoPendiente?: number | null;
  esRecurrenteMensual?: boolean;
  cuotaMensualAcordada?: number | null;
  fechaPrestamo?: Date;
  metodo?: string | null;
  corteId?: number | null;
  creadoPorPersonaId?: number | null;
  origenCruceAporteId?: number | null;
  aprobaciones?: AprobacionPrestamo[];
}

export type EstadoAprobacion = 'Pendiente' | 'Aprobado' | 'Rechazado';

export interface AprobacionPrestamo {
  id: number;
  prestamoId: number;
  personaId: number;
  persona: string | null;
  estado: EstadoAprobacion;
  comentarios: string | null;
  /** ISO-8601 (null mientras está pendiente). */
  fechaAprobacion: string | null;
}
