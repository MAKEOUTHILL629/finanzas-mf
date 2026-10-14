/**
 * Aportes diarios del carro, saldo a favor, cargos recurrentes por persona y liquidación de fin de mes.
 * Estos endpoints responden en camelCase y con los montos ya como `number` (la capa HTTP convierte Decimal → number).
 */
import { Periodo } from './erp';

// ───────────────────────────── Aportes del carro ─────────────────────────────

/** Métodos canónicos; los aportes migrados de AppSheet traen otros textos (`Fisico`, `Bancolombia`, `Prestamo`…). */
export type MetodoAporteCarro = 'EFECTIVO' | 'TRANSFERENCIA' | 'CRUCE_CUENTAS' | 'SALDO_A_FAVOR';
export type MetodoCanonico = MetodoAporteCarro | 'OTRO';

export type EstadoPeriodoAporte = 'PENDIENTE' | 'PARCIAL' | 'COMPLETADO' | 'CON_SALDO_A_FAVOR';

export interface PersonaResumen {
  id: number;
  nombre: string | null;
  iniciales: string | null;
  color: string | null;
}

export interface DetalleAporteDiario {
  id: number;
  aporteDiarioId: number;
  valor: number;
  /** Texto guardado: canónico (`EFECTIVO`…) o heredado (`Fisico`, `Carrera`…). */
  metodo: string;
  metodoCanonico: MetodoCanonico;
  personaId: number;
  personaNombre: string | null;
  personaColor: string | null;
  comentarios: string | null;
  cuentaFinancieraId: number | null;
  cuentaNombre: string | null;
  transaccionId: number | null;
  /** Préstamo POR_COBRAR que el Trigger 3 creó cuando la persona es un tercero (el «cruce»). */
  prestamoCruceGeneradoId: number | null;
  esCruce: boolean;
  origenObligacionMesId: number | null;
}

export interface AporteDiario {
  id: number;
  obligacionMesId: number;
  periodo: Periodo;
  /** `yyyy-MM-ddT00:00:00.000Z` (columna `date`). */
  fecha: string;
  notas: string | null;
  valorTotal: number;
  detalles: DetalleAporteDiario[];
}

export interface PeriodoCarro {
  id: number;
  tipoObligacion: string;
  periodo: Periodo;
  concepto: string;
  responsable: PersonaResumen;
  valorCuotaObjetivo: number;
  montoAbonado: number;
  saldoPendiente: number;
  saldoAFavorGenerado: number;
  saldoAFavorAplicado: number;
  saldoAFavorDisponible: number;
  estado: EstadoPeriodoAporte;
  /** Compatibilidad con `/obligaciones-mes`: ABIERTO hasta alcanzar la cuota. */
  estadoCalculado: 'ABIERTO' | 'COMPLETADO';
  progresoPorcentaje: number;
  aportadoPorCruces: number;
  aportadoDirecto: number;
  cantidadAportes: number;
  aportes: AporteDiario[];
}

export interface ResumenCarro {
  tipoObligacion: string;
  responsable: PersonaResumen | null;
  /** Cuota del periodo más reciente: sugerencia para el siguiente mes. */
  cuotaBase: number | null;
  periodoActual: Periodo;
  periodoSeleccionadoId: number | null;
  saldoAFavorDisponibleGlobal: number;
  periodos: PeriodoCarro[];
}

export interface DetalleAporteDiarioEnvio {
  /** Solo al editar: id del detalle existente (si no cambia, conserva su cruce y su transacción). */
  id?: number;
  valor: string;
  /** Canónico, o el texto heredado sin cambios al editar un aporte migrado. */
  metodo: string;
  personaId: number;
  cuentaFinancieraId?: number;
  comentarios?: string;
  origenObligacionMesId?: number;
}

export interface CrearAporteDiario {
  fecha: string;
  periodo?: Periodo;
  notas?: string;
  detalles: DetalleAporteDiarioEnvio[];
}

export interface ResultadoAporteDiario {
  aporteDiario: AporteDiario;
  periodo: PeriodoCarro;
  transaccionesCreadas: number;
  crucesGenerados: number;
}

export interface EliminadoAporteDiario {
  eliminado: boolean;
  aporteDiarioId: number;
  detallesEliminados: number;
  crucesAnulados: number;
  transaccionesAnuladas: number;
}

export interface GuardarPeriodo {
  periodo: Periodo;
  valorCuota: string;
  concepto?: string;
}

export interface ResultadoGuardarPeriodo {
  creado: boolean;
  periodo: PeriodoCarro;
}

export type DestinoExcedente = 'SIGUIENTE_MES' | 'ESTADO_CUENTA';

export interface AplicarExcedente {
  destino: DestinoExcedente;
  valor?: string;
  periodoImputacion?: Periodo;
}

export interface ResultadoAplicarExcedente {
  destino: DestinoExcedente;
  valorAplicado: number;
  movimientoId: number | null;
  periodoDestino: PeriodoCarro | null;
  periodo: PeriodoCarro;
}

// ───────────────────────────── Recurrentes por persona ─────────────────────────────

export type NaturalezaRecurrentePersona = 'CARGO_A_COBRAR' | 'ABONO_A_FAVOR';
export type ModalidadDuracion = 'INDEFINIDO' | 'PLAZO_FIJO';

export interface RecurrentePersona {
  id: number;
  personaId: number;
  personaNombre: string | null;
  personaIniciales: string | null;
  personaColor: string | null;
  concepto: string;
  valorMensual: number;
  naturaleza: NaturalezaRecurrentePersona;
  modalidadDuracion: ModalidadDuracion;
  vitalicio: boolean;
  numeroMeses: number | null;
  mesInicio: Periodo;
  mesFin: Periodo | null;
  cuotasGeneradas: number;
  diaCobro: number;
  activo: boolean;
  estado: 'ACTIVO' | 'FINALIZADO';
  notas: string | null;
  progreso: { actual: number; total: number; porcentaje: number } | null;
}

export interface CrearRecurrentePersona {
  personaId: number;
  concepto: string;
  valorMensual: string;
  naturaleza: NaturalezaRecurrentePersona;
  modalidadDuracion: ModalidadDuracion;
  numeroMeses?: number;
  mesInicio: Periodo;
  diaCobro?: number;
  notas?: string;
}

export type ActualizarRecurrentePersona = Partial<Omit<CrearRecurrentePersona, 'personaId'>> & { activo?: boolean };

export interface FiltroRecurrentesPersona {
  personaId?: number | null;
  activo?: boolean | null;
  modalidadDuracion?: ModalidadDuracion | null;
}

export interface ResultadoGenerarMes {
  periodo: Periodo;
  movimientosGenerados: number;
  recurrentes: RecurrentePersona[];
}

// ───────────────────────────── Liquidación mensual ─────────────────────────────

export type OrigenMovimiento =
  | 'COMPRA_CREDITO'
  | 'PRESTAMO'
  | 'RECURRENTE_COMPARTIDO'
  | 'RECURRENTE_PERSONA'
  | 'CRUCE_APORTE_CARRO'
  | 'CRUCE_ENTRE_PERSONAS'
  | 'SALDO_A_FAVOR_CARRO'
  | 'PAGO_RECIBIDO'
  | 'OTRO';

export interface ItemLiquidacion {
  id: number;
  fecha: string;
  concepto: string;
  comentario: string | null;
  tipoMovimiento: string;
  origen: OrigenMovimiento;
  signo: 1 | -1;
  monto: number;
  /** `monto × signo`: lo que suma (+) o resta (−) a lo que la persona te debe. */
  impacto: number;
  estado: string | null;
  prestamoId: number | null;
  cruceDeudaId: number | null;
  cargoRecurrentePersonaId: number | null;
  obligacionMesId: number | null;
  cuotaDetalleId: number | null;
}

export interface BloqueLiquidacion {
  items: ItemLiquidacion[];
  /** Impacto neto del bloque. */
  subtotal: number;
}

export interface ObligacionLiquidacion {
  obligacionMesId: number;
  tipoObligacion: string;
  periodo: Periodo;
  concepto: string;
  valorCuotaObjetivo: number;
  montoAbonado: number;
  saldoPendiente: number;
  saldoAFavorGenerado: number;
  saldoAFavorAplicado: number;
  saldoAFavorDisponible: number;
  estado: EstadoPeriodoAporte;
  progresoPorcentaje: number;
}

export type EstadoLiquidacion = 'DEBE' | 'A_FAVOR' | 'PAZ_Y_SALVO';

export interface LiquidacionPersona {
  persona: PersonaResumen;
  cuotasTarjetas: BloqueLiquidacion;
  cuotasPrestamos: BloqueLiquidacion;
  cargosRecurrentes: BloqueLiquidacion;
  crucesCuentas: BloqueLiquidacion;
  saldoAFavorAplicado: BloqueLiquidacion;
  abonosRealizados: BloqueLiquidacion;
  otros: BloqueLiquidacion;
  estadoAporteCarro: ObligacionLiquidacion | null;
  obligaciones: ObligacionLiquidacion[];
  faltanteObligacion: number;
  resumenNeto: { totalCargos: number; totalAbonosYFavor: number; saldoNetoFinal: number; estado: EstadoLiquidacion };
  saldoAnterior: number;
  saldoTotalAcumulado: number;
  tieneActividad: boolean;
}

export interface LiquidacionMensual {
  periodo: Periodo;
  recurrentesGenerados: number;
  personas: LiquidacionPersona[];
  totales: { totalCargos: number; totalAbonosYFavor: number; saldoNetoFinal: number };
}

export interface CruceEntrePersonas {
  personaOrigenId: number;
  personaDestinoId: number;
  monto: string;
  periodo?: Periodo;
  fecha?: string;
  concepto: string;
  comentarios?: string;
}

export interface RegistrarPagoMes {
  personaId: number;
  monto: string;
  periodo?: Periodo;
  cuentaDestinoId?: number;
  concepto?: string;
}
