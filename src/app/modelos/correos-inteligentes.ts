/**
 * Productos detectados en los correos del banco (por los últimos 4 dígitos) y reproceso de los correos pendientes.
 * Contratos de `/api/notificaciones-correo/productos` y `/api/notificaciones-correo/reprocesar`.
 */

export interface AsignadoA {
  tipo: 'TARJETA' | 'CUENTA';
  id: number;
  nombre: string;
}

export type SugerenciaProducto =
  | { tipo: 'TARJETA_EXISTENTE'; tarjetaId: number; tarjeta: string; votos: number; total: number; automatica: boolean }
  | { tipo: 'CREAR_TARJETA' }
  | { tipo: 'CREAR_CUENTA'; nombre: string; tipoCuenta: string; esPrincipal: boolean }
  | { tipo: 'AGREGAR_A_CUENTA'; cuentaId: number; cuenta: string };

export interface ProductoDetectado {
  ultimos4: string;
  instrumento: 'TC' | 'CUENTA';
  esDebito: boolean;
  correos: number;
  pendientes: number;
  primera: string | null;
  ultima: string | null;
  /** Suma en COP de los correos (texto decimal). */
  totalCop: number | string;
  asignadoA: AsignadoA | null;
  sugerencia: SugerenciaProducto | null;
}

export interface AsignarProducto {
  ultimos4: string;
  destino: 'TARJETA' | 'CUENTA';
  /** Producto existente al que se agregan los dígitos… */
  id?: number;
  /** …o los datos del producto nuevo que se crea con ellos. */
  nuevo?: {
    nombre?: string;
    tipoCuenta?: string;
    bancoEntidad?: string;
    saldoInicial?: number | string;
    esPrincipal?: boolean;
    franquicia?: string;
    descripcion?: string;
  };
}

export interface ResultadoAsignacion {
  ultimos4: string;
  destino: 'TARJETA' | 'CUENTA';
  id: number;
  nombre: string;
  creado: boolean;
}

export interface ResultadoAceptarSugerencias {
  aplicados: ResultadoAsignacion[];
  omitidos: Array<{ ultimos4: string; motivo: string }>;
}

export interface AprendizajeTarjeta {
  ultimos4: string;
  tarjetaId: number;
  tarjeta: string;
  votos: number;
  total: number;
  aplicado: boolean;
}

export interface MuestraReproceso {
  notificacionId: number;
  fecha: string;
  comercio: string | null;
  monto: string | null;
  moneda: string;
  accion: string;
  motivo: string;
  vinculo: string | null;
}

export interface ResumenReproceso {
  simulado: boolean;
  desde: string | null;
  evaluados: number;
  acciones: Record<string, number>;
  motivos: Record<string, number>;
  omitidos: number;
  errores: Array<{ notificacionId: number; error: string }>;
  muestras: MuestraReproceso[];
  aprendizajes: AprendizajeTarjeta[];
}

export interface ReprocesarCorreos {
  /** `yyyy-MM-dd`: desde esta fecha se REGISTRA lo nuevo; antes solo se enlaza con lo que ya existe. */
  desde?: string;
  /** Por defecto `true` (solo simula). */
  simular?: boolean;
  ids?: number[];
  motivos?: string[];
  incluirConError?: boolean;
  chunkSize?: number;
}

export interface ResultadoReprocesoBulk {
  totalEvaluados: number;
  conciliados: number;
  descartadosRechazados: number;
  ignorados: number;
  duplicados: number;
  pendientesRestantes: number;
  errores: number;
  omitidos: number;
  comprasCreadas: number;
  comprasEnlazadas: number;
  transaccionesCreadas: number;
  transaccionesEnlazadas: number;
  tiempoTotalMs: number;
  velocidadCorreosPorSegundo: number;
  acciones: Record<string, number>;
  motivos: Record<string, number>;
  muestras: MuestraReproceso[];
  aprendizajes: AprendizajeTarjeta[];
  detalleErrores: Array<{ notificacionId: number; error: string }>;
}

/** Falso positivo histórico (Fase 1): compra creada desde un correo que era pago de tarjeta o compra rechazada. */
export interface FalsoPositivoCorreo {
  notificacionId: number;
  compraId: number | null;
  fecha: string;
  comercio: string | null;
  monto: string | null;
  tipoDetectado: 'TRANSACCION_RECHAZADA' | 'PAGO_ABONO_TARJETA';
  accionSugerida: 'ELIMINAR_COMPRA' | 'CONVERTIR_EN_PAGO_TARJETA' | 'SOLO_MARCAR';
  puedeRevertir: boolean;
  motivoBloqueo: string | null;
}

export interface ResultadoAuditoriaCorreos {
  total: number;
  falsosPositivos: FalsoPositivoCorreo[];
}

export interface ResultadoReversionCorreos {
  revertidos: number;
  convertidos: number;
  omitidos: Array<{ notificacionId: number; motivo: string }>;
}

export interface RechazadoHistoricoDetectado {
  notificacionId: number;
  fecha: string;
  asunto: string | null;
  comercio: string | null;
  monto: string | null;
  patronDetectado: string;
  estadoActual: string;
  compraId: number | null;
  cuotasAsociadas: number;
  responsablesAsociados: number;
  movimientosDeudaAsociados: number;
  transaccionId: number | null;
  cuentaAfectadaId: number | null;
  nombreCuenta: string | null;
  impactoSaldoCop: string | null;
}

export interface ReporteAuditoriaRechazados {
  ejecutado: boolean;
  correosRechazadosDetectados: number;
  correosActualizadosADescartado: number;
  comprasCreditoEliminadas: number;
  cuotasEliminadas: number;
  responsablesEliminados: number;
  movimientosDeudaEliminados: number;
  transaccionesEliminadas: number;
  saldosCuentasRestaurados: Array<{ cuentaId: number; nombreCuenta: string; diferenciaRestaurada: string }>;
  items: RechazadoHistoricoDetectado[];
}

export interface TrabajoReproceso {
  jobId: string;
  total: number;
}

export interface EstadoTrabajoReproceso {
  jobId: string;
  estado: 'EN_CURSO' | 'TERMINADO' | 'FALLIDO';
  total: number;
  procesados: number;
  iniciado: string;
  terminado: string | null;
  resumen: ResumenReproceso | null;
  error: string | null;
}

export interface ResponsableSugeridoPrefill {
  personaId: number;
  porcentajePago: string;
  cantidadCuotas: number | null;
}

export interface PrefillConciliacionSugerido {
  notificacionId: number;
  tipoDestino: 'COMPRA_CREDITO' | 'TRANSACCION_CUENTA' | 'TRANSFERENCIA_INTERNA' | 'PRESTAMO';
  conceptoSugerido: string | null;
  descripcionLimpia: string | null;
  montoSugerido: string | null;
  moneda: string;
  fechaSugerida: string | null;
  ultimos4: string | null;
  esTarjetaCredito: boolean;
  tarjetaId: number | null;
  cuentaId: number | null;
  categoriaId: number | null;
  numeroCuotas: number | null;
  responsablesSugeridos: ResponsableSugeridoPrefill[];
  personaSugeridaId: number | null;
  registroExistenteId: number | null;
  registroExistenteTipo: 'COMPRA_CREDITO' | 'TRANSACCION' | null;
  confianza: number;
  muestrasHistoricas: number;
  etiquetaOrigen: string | null;
}
