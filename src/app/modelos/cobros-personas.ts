/**
 * Cobros a personas: gastos repartidos (luz, mercado, eventos), enlaces para compartir la liquidación y pagos que cada
 * persona reporta con su comprobante. Contratos de `/api/cobros-puntuales`, `/api/cobros` y `/api/publico/cobros`.
 */
import { DetalleItemLiquidacion, EstadoLiquidacion } from './aportes';
import { Periodo } from './erp';

export type CategoriaCobro = 'SERVICIO' | 'MERCADO' | 'EVENTO' | 'OTRO';
export type ModoDivision = 'IGUAL' | 'PORCENTAJE' | 'MONTO';
export type EstadoCobro = 'ACTIVO' | 'ANULADO';

export interface ParticipanteCobroEntrada {
  personaId: number;
  monto?: number | string;
  porcentaje?: number | string;
}

export interface GuardarCobroPuntual {
  concepto: string;
  categoria?: CategoriaCobro;
  /** yyyy-MM-dd */
  fechaGasto: string;
  periodo?: Periodo;
  montoTotal: number | string;
  modoDivision?: ModoDivision;
  participantes: ParticipanteCobroEntrada[];
  transaccionId?: number;
  compraCreditoId?: number;
  notificacionId?: number;
  notas?: string;
}

export interface ParticipanteCobro {
  personaId: number;
  nombre: string | null;
  iniciales: string | null;
  color: string | null;
  monto: number;
  porcentaje: number | null;
  esPropio: boolean;
}

export interface CobroPuntual {
  id: number;
  concepto: string;
  categoria: CategoriaCobro;
  fechaGasto: string;
  periodo: Periodo;
  montoTotal: number;
  modoDivision: ModoDivision;
  estado: EstadoCobro;
  notas: string | null;
  transaccionId: number | null;
  compraCreditoId: number | null;
  notificacionId: number | null;
  montoACobrar: number;
  parteDelPropietario: number;
  participantes: ParticipanteCobro[];
}

// ───────────────────────────── enlaces ─────────────────────────────

export interface ResumenCobro {
  totalCargos: number;
  totalAbonosYFavor: number;
  saldoNetoFinal: number;
  estado: EstadoLiquidacion | string;
  saldoAnterior: number;
  saldoTotalAcumulado: number;
}

export interface GenerarEnlace {
  personaId: number;
  periodo: Periodo;
  mensaje?: string;
  instruccionesPago?: string;
  diasVigencia?: number;
  rotarToken?: boolean;
}

export interface EnlaceCobro {
  id: number;
  personaId: number;
  persona: string | null;
  periodo: Periodo;
  token: string;
  /** Ruta de la página pública: `/p/<token>`. */
  ruta: string;
  mensaje: string | null;
  instruccionesPago: string | null;
  expiraEn: string;
  revocado: boolean;
  vigente: boolean;
  vistas: number;
  ultimaVistaEn: string | null;
  snapshotEn: string;
  resumen: ResumenCobro | null;
  reportesPendientes: number;
  /** Observaciones de la persona que aún esperan tu respuesta. */
  objecionesAbiertas: number;
}

// ───────────────────────────── pagos reportados ─────────────────────────────

export type EstadoReporte = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
export type MedioPago = 'TRANSFERENCIA' | 'BREB' | 'NEQUI' | 'DAVIPLATA' | 'EFECTIVO' | 'OTRO';

export interface CorreoCoincidente {
  notificacionId: number;
  transaccionId: number;
  fecha: string;
  monto: number;
  cuentaId: number | null;
}

export interface ReportePago {
  id: number;
  enlaceId: number | null;
  personaId: number;
  persona: string | null;
  periodo: Periodo;
  montoReportado: number;
  /** Lo que debía la persona cuando avisó su pago (`null` en los avisos anteriores a la fase 6). */
  saldoAlReportar: number | null;
  /** Avisó menos de lo que debía: queda `pendienteTrasPago` por cobrar. */
  esParcial: boolean;
  pendienteTrasPago: number | null;
  fechaPago: string;
  medio: MedioPago | string | null;
  referencia: string | null;
  comentario: string | null;
  tieneComprobante: boolean;
  comprobanteNombre: string | null;
  comprobanteTipo: string | null;
  comprobanteTamano: number | null;
  estado: EstadoReporte;
  montoAprobado: number | null;
  motivoRechazo: string | null;
  revisadoEn: string | null;
  creadoEn: string | null;
  transaccionId: number | null;
  movimientoId: number | null;
  /** El dinero ya aparece en tus cuentas (correo del banco): se puede aprobar enlazándolo. */
  correoCoincidente: CorreoCoincidente | null;
}

export interface AprobarReporte {
  monto?: number | string;
  cuentaDestinoId?: number;
  transaccionId?: number;
}

export interface ResultadoAprobacion {
  reporteId: number;
  estado: 'APROBADO';
  monto: number;
  movimientoId: number;
  transaccionId: number | null;
}

export interface IngresoSugerido {
  notificacionId: number;
  transaccionId: number;
  fecha: string;
  personaId: number;
  persona: string | null;
  monto: number;
  concepto: string | null;
  cuentaId: number | null;
}

export interface AplicarIngreso {
  transaccionId: number;
  personaId: number;
  periodo: Periodo;
  monto?: number | string;
}

// ───────────────────────────── página pública ─────────────────────────────

export interface ItemCobroPublico {
  /** Identifica el renglón para poder observarlo. */
  clave?: string;
  fecha: string;
  concepto: string;
  monto: number;
  signo: 1 | -1;
  impacto: number;
  origen: string;
  detalle: DetalleItemLiquidacion | null;
}

export interface BloqueCobroPublico {
  clave: string;
  titulo: string;
  subtotal: number;
  items: ItemCobroPublico[];
}

export interface ReportePublico {
  id: number;
  monto: number;
  fechaPago: string;
  estado: EstadoReporte;
  motivoRechazo: string | null;
  montoAprobado: number | null;
  /** Avisó menos de lo que debía en ese momento: el resto sigue pendiente. */
  parcial?: boolean;
  creadoEn: string | null;
  conComprobante: boolean;
}

/** Lo que ve la persona al abrir su enlace (sin iniciar sesión). */
export interface CobroPublico {
  version: number;
  periodo: Periodo;
  generadoEn: string;
  propietario: { nombre: string | null };
  persona: { nombre: string | null; iniciales: string | null; color: string | null };
  bloques: BloqueCobroPublico[];
  obligaciones: Array<{ concepto: string; metaMensual: number; montoAbonado: number; saldoPendiente: number }>;
  resumen: ResumenCobro;
  mensaje: string | null;
  instruccionesPago: string | null;
  venceEn: string;
  actualizadoEn: string;
  reportes: ReportePublico[];
  /** Dónde puedes pagar (medios activos del propietario). */
  metodosPago: MetodoPagoPublico[];
  /** Tus observaciones sobre este cobro y lo que te respondieron. */
  objeciones: ObjecionPublica[];
}

export interface ComprobanteEnvio {
  nombre: string;
  tipo: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  /** Contenido en base64 (sin el prefijo `data:`). */
  datos: string;
}

export interface ReportarPago {
  monto: number | string;
  /** yyyy-MM-dd */
  fechaPago: string;
  medio?: MedioPago;
  referencia?: string;
  comentario?: string;
  comprobante?: ComprobanteEnvio;
}

export interface ResultadoReporte {
  id: number;
  estado: EstadoReporte;
  creadoEn: string | null;
  /** Pagó menos de lo que debía. */
  parcial: boolean;
  saldoRestante: number | null;
  mensaje: string;
}

// ───────────────────────────── medios de pago ─────────────────────────────

export type TipoMetodoPago = 'CUENTA_AHORROS' | 'CUENTA_CORRIENTE' | 'NEQUI' | 'DAVIPLATA' | 'LLAVE' | 'OTRO';

/** Un medio de pago tuyo, tal como lo administras (`/api/metodos-pago`). */
export interface MetodoPago {
  id: number;
  tipo: TipoMetodoPago;
  entidad: string;
  numero: string;
  titular: string | null;
  documento: string | null;
  instrucciones: string | null;
  cuentaId: number | null;
  tieneQr: boolean;
  activo: boolean;
  orden: number;
  creadoEn: string;
}

export interface GuardarMetodoPago {
  tipo: TipoMetodoPago;
  entidad: string;
  numero: string;
  titular?: string | null;
  documento?: string | null;
  instrucciones?: string | null;
  cuentaId?: number | null;
  activo?: boolean;
  orden?: number;
}

/** Lo que ve la persona en «¿Dónde puedes pagar?». */
export interface MetodoPagoPublico {
  id: number;
  tipo: TipoMetodoPago | string;
  entidad: string;
  numero: string;
  titular: string | null;
  documento: string | null;
  instrucciones: string | null;
  tieneQr: boolean;
}

// ───────────────────────────── observaciones y ajustes ─────────────────────────────

export type AlcanceObjecion = 'ITEM' | 'TOTAL';
export type EstadoObjecion = 'ABIERTA' | 'RESUELTA';
export type ResolucionObjecion = 'MANTENIDA' | 'AJUSTADA' | 'EXCLUIDA' | 'DESCUENTO';
export type AccionObjecion = 'MANTENER' | 'AJUSTAR' | 'EXCLUIR' | 'DESCUENTO';

/** Lo que la persona dejó dicho sobre un cobro y la respuesta del propietario. */
export interface ObjecionPublica {
  id: number;
  alcance: AlcanceObjecion;
  /** Identifica el rubro observado (coincide con `clave` de su renglón en el detalle). */
  itemClave: string | null;
  /** El cobro observado (`null` si es sobre el total). */
  concepto: string | null;
  /** Lo que la persona veía en ese renglón. */
  monto: number | null;
  comentario: string;
  montoPropuesto: number | null;
  estado: EstadoObjecion;
  resolucion: ResolucionObjecion | null;
  respuesta: string | null;
  montoAjuste: number | null;
  creadaEn: string;
  resueltaEn: string | null;
}

export interface ObjecionCobro extends ObjecionPublica {
  enlaceId: number;
  personaId: number;
  persona: string | null;
  periodo: Periodo;
  movimientoId: number | null;
}

export interface ObjetarCobro {
  alcance: AlcanceObjecion;
  itemClave?: string;
  comentario: string;
  montoPropuesto?: number | string;
}

export interface ResultadoObjecion extends ObjecionPublica {
  mensaje: string;
}

export interface ResolverObjecion {
  accion: AccionObjecion;
  /** AJUSTAR: el monto nuevo a cobrar por el renglón. DESCUENTO: lo que se descuenta del saldo. */
  monto?: number | string;
  respuesta?: string;
}

export interface ResultadoResolucion {
  objecion: ObjecionCobro;
  descuento: number | null;
  enlace: EnlaceCobro;
}

export interface DescuentoDirecto {
  monto: number | string;
  motivo: string;
}

export interface ResultadoDescuento {
  movimientoId: number;
  descuento: number;
  enlace: EnlaceCobro;
}

/** Un descuento o ajuste vigente de un enlace. */
export interface AjusteCobro {
  movimientoId: number;
  monto: number;
  concepto: string | null;
  fecha: string;
  objecionId: number | null;
}
