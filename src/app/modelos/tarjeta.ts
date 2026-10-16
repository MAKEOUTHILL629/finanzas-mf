/** Motivo por el que se reemplazó el plástico ANTERIOR de una tarjeta. */
export type MotivoReemplazo = 'VENCIMIENTO' | 'PERDIDA' | 'ROBO' | 'DETERIORO' | 'FRAUDE' | 'CAMBIO_PRODUCTO' | 'OTRO';

/** Un plástico (reposición/renovación) de una tarjeta de crédito: el banco cambia los últimos 4 dígitos, la línea de crédito sigue siendo la misma. */
export interface PlasticoTarjeta {
  id: number;
  tarjetaId: number;
  ultimos4: string;
  esActivo: boolean;
  /** `yyyy-MM-dd`; `null` = se desconoce desde cuándo. */
  vigenteDesde: string | null;
  vigenteHasta: string | null;
  motivoReemplazo: MotivoReemplazo | null;
  reemplazaAId: number | null;
  notas: string | null;
  /** Solo en `GET /tarjetas/:id/plasticos`: compras con este plástico guardado. */
  compras?: number;
}

export interface Tarjeta{
  id?: number;
  fechaCreacion?: Date;
  franquicia?: string;
  descripcion?: string;
  tasaInteresCompra?: number | null;
  tasaInteresAvance?: number | null;
  cuotaManejo?: number | null;
  urlInfo?: string | null;
  ultimaActualizacionTasas?: string | null;
  extractTasas?: boolean;
  // Campos del esquema Supabase (el backend NestJS los devuelve además del contrato legacy)
  diaCorte?: number | null;
  diaLimitePago?: number | null;
  cupoTotal?: number | null;
  permiteDolares?: boolean | null;
  /** Todos los plásticos de la tarjeta separados por coma, el activo primero ("1927,9587"). Solo lectura: se gestionan con `plasticos`. */
  ultimos4Digitos?: string | null;
  /** Últimos 4 dígitos del plástico vigente: el que se ofrece al registrar compras nuevas. */
  ultimos4Activo?: string | null;
  plasticoActivo?: PlasticoTarjeta | null;
  /** Todos los plásticos (el activo primero, luego del más reciente al más antiguo). */
  plasticos?: PlasticoTarjeta[];
}

export interface ReemplazarPlastico {
  ultimos4: string;
  /** `yyyy-MM-dd`; por defecto hoy. */
  vigenteDesde?: string;
  motivo?: MotivoReemplazo;
  notas?: string;
}

export interface ActualizarPlastico {
  vigenteDesde?: string | null;
  vigenteHasta?: string | null;
  motivo?: MotivoReemplazo | null;
  notas?: string | null;
  esActivo?: true;
}

export interface ResultadoReemplazo {
  plasticoActivo: PlasticoTarjeta;
  plasticoAnterior: PlasticoTarjeta | null;
  plasticos: PlasticoTarjeta[];
}

export interface FiltroHistorialTarjeta {
  plasticoId?: number | null;
  desde?: string | null;
  hasta?: string | null;
  pagina?: number;
  limite?: number;
}

export interface ResponsableHistorial {
  personaId: number | null;
  nombre: string | null;
  porcentaje: number | null;
  cuotas: number | null;
}

export interface CompraHistorial {
  id: number;
  concepto: string | null;
  fechaCompra: string | null;
  valorCompra: number;
  monedaOriginal: string;
  numeroCuotas: number;
  cuotasPendientes: number;
  saldoPendiente: number;
  proximaCuota: string | null;
  estado: string | null;
  /** Con qué plástico se pagó: el guardado en la compra o, si no, el vigente en su fecha (`plasticoInferido`). */
  plastico: { id: number; ultimos4: string; esActivo: boolean } | null;
  plasticoInferido: boolean;
  responsables: ResponsableHistorial[];
}

export interface ResumenPlasticoHistorial {
  plasticoId: number | null;
  ultimos4: string | null;
  esActivo: boolean;
  compras: number;
  valorCompras: number;
  inferidas: number;
}

export interface HistorialTarjeta {
  tarjeta: { id: number; franquicia: string | null; descripcion: string | null };
  plasticos: PlasticoTarjeta[];
  filtro: { plasticoId: number | null; desde: string | null; hasta: string | null };
  totales: { compras: number; valorCompras: number; saldoPendiente: number };
  porPlastico: ResumenPlasticoHistorial[];
  paginacion: { pagina: number; limite: number; total: number };
  compras: CompraHistorial[];
}
