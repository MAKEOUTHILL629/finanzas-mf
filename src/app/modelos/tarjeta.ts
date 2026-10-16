/** Motivo por el que se reemplazó el plástico ANTERIOR de una tarjeta. */
export type MotivoReemplazo = 'VENCIMIENTO' | 'PERDIDA' | 'ROBO' | 'DETERIORO' | 'FRAUDE' | 'CAMBIO_PRODUCTO' | 'OTRO';

export type TipoTarjeta = 'CREDITO' | 'DEBITO';

/** ACTIVA = vigente · REEMPLAZADA = la tarjeta siguió con otro plástico · INACTIVA = histórica sin continuidad. */
export type EstadoPlastico = 'ACTIVA' | 'INACTIVA' | 'REEMPLAZADA';

/** Un plástico (reposición/renovación) de una tarjeta: el banco cambia los últimos 4 dígitos, la línea sigue siendo la misma. */
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
  estado?: EstadoPlastico;
  /** Alias de `vigenteDesde` / `vigenteHasta` / `reemplazaAId` con los nombres del plan de producto. */
  fechaInicioUso?: string | null;
  fechaFinUso?: string | null;
  tarjetaReemplazadaId?: number | null;
}

export interface Tarjeta{
  id?: number;
  /** CREDITO | DEBITO (por defecto, crédito). */
  tipo?: TipoTarjeta;
  /** Cuenta a la que pertenece: obligatoria en débito; en crédito, la que la paga (opcional). */
  cuentaId?: number | null;
  /** Nombre corto para mostrar («Débito *3698»). */
  alias?: string | null;
  /** Producto «sin número»: recibe lo que el banco avisa sin los últimos 4 dígitos. */
  esGenerica?: boolean;
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

/** `POST /api/tarjetas`: una tarjeta nueva con su plástico o, con `plasticoAnteriorId`, el plástico que renueva a otro. */
export interface CrearTarjeta {
  tipo: TipoTarjeta;
  cuentaId?: number;
  ultimos4?: string;
  franquicia?: string;
  alias?: string;
  descripcion?: string;
  estado?: 'ACTIVA' | 'INACTIVA';
  fechaInicioUso?: string;
  fechaFinUso?: string;
  plasticoAnteriorId?: number;
  motivo?: MotivoReemplazo;
  esGenerica?: boolean;
  diaCorte?: number;
  diaLimitePago?: number;
  cupoTotal?: number | string;
  notas?: string;
}

/** `POST /api/tarjetas/:id/plasticos`: agrega un plástico histórico sin cambiar el activo. */
export interface AgregarPlastico {
  ultimos4: string;
  vigenteDesde?: string;
  vigenteHasta?: string;
  motivo?: MotivoReemplazo;
  notas?: string;
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
  /** Solo en el cliente: se agregó un plástico anterior y el vigente no cambió. */
  historico?: boolean;
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
