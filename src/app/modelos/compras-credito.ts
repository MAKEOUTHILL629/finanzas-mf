export interface ComprasCredito {
  id?: number;
  fechaCreacion?: Date;
  concepto?: string;
  valorCompra?: number;
  fechaCompra?: Date | string | number;
  numeroCuotas?: number;
  fechaUltimaCuota?: Date | string | number;
  pagoMensual?: number;
  interes?: number;
  descripcion?: string;
  estado?: string;
  tarjeta?: number;
  responsables?: string;
  porcentajePago?: number;
  /** Plástico con el que se pagó (solo se envía al registrar una compra retroactiva; el servidor lo deduce si no llega). */
  plasticoId?: number | null;
  tags?: string[];
  comercioCanonico?: string | null;
}

/**
 * Respuesta del backend NestJS: además del contrato legacy trae el modelo multimoneda (Supabase).
 * `valorCompra` siempre está en COP; las compras en USD traen su valor y TRM originales.
 * (Se mantiene aparte de `ComprasCredito` para no ampliar `keyof ComprasCredito` en las comparaciones de los formularios.)
 */
export interface ComprasCreditoMultimoneda extends ComprasCredito {
  monedaOriginal?: string;
  valorMonedaOriginal?: number | null;
  tasaCambioAplicada?: number | null;
  trmConfirmada?: boolean | null;
  /** Plástico guardado en la compra (las anteriores a esta función no lo tienen: el historial de la tarjeta lo deduce por fecha). */
  plasticoUltimos4?: string | null;
  /** La compra maestra que la unificó en un refinanciamiento (`null` = no fue unificada). */
  refinanciamientoId?: number | null;
  /** La compra ES la obligación nueva de un refinanciamiento. */
  esRefinanciamiento?: boolean;
  /** Capital pendiente que se llevó la obligación nueva (solo en las unificadas). */
  saldoRefinanciado?: number | null;
  /** `CAPITAL_FIJO` (compras normales) | `FRANCES` (cuota fija: los refinanciamientos creados por el asistente). */
  sistemaAmortizacion?: string;
  cuotaFijaPactada?: number | null;
  /** Tags transversales (Fase 2): slugs con '#'. */
  tags?: string[];
  comercioCanonico?: string | null;
}

export type EstadoRealCuota = 'PAGADA' | 'EN_EXTRACTO_ACTUAL' | 'FUTURA' | 'ABSORBIDA_REFINANCIAMIENTO';

export interface DetalleCompletoCompraCredito {
  compra: ComprasCreditoMultimoneda;
  tarjeta: {
    id: number;
    nombre: string;
    franquicia: string | null;
    descripcion: string | null;
    etiqueta: string;
    ultimos4Activo: string | null;
    diaCorte: number | null;
    diaLimitePago: number | null;
    tasaInteresCompra: number | null;
    cupoTotal: number | null;
  } | null;
  plastico: {
    id: number;
    ultimos4: string;
    esActivo: boolean;
    vigenteDesde: string | null;
    vigenteHasta: string | null;
    tipo: string;
  } | null;
  cuotas: Array<{
    id: number;
    numeroCuota: number;
    fechaPago: number | null;
    fechaPagoIso: string | null;
    saldoRestante: number;
    interesPagado: number;
    aporteCapital: number;
    pagoTotal: number;
    estado: string | null;
    estadoReal: EstadoRealCuota;
    periodoFacturacion: string | null;
  }>;
  responsables: Array<{
    id: number;
    personaId: number | null;
    nombre: string;
    iniciales: string | null;
    color: string | null;
    esPropia: boolean;
    porcentajePago: number;
    cantidadPago: number;
    cantidadCuotas: number;
    estadoCobroLiquidacion: 'COBRADO' | 'EN_LIQUIDACION' | 'PENDIENTE' | 'PROPIO';
    montoCobrado: number;
  }>;
  notificacionCorreo: {
    id: number;
    externalMessageId: string;
    remitente: string | null;
    asunto: string | null;
    fechaCorreo: string;
    cuerpoExtraido: string | null;
    datosParseados: Record<string, unknown> | null;
    estadoProcesamiento: string | null;
    ultimos4: string | null;
    comercioNormalizado: string | null;
    montoOriginal: number | null;
    moneda: string | null;
    vinculo: string | null;
  } | null;
  refinanciamiento: {
    id: number;
    concepto: string | null;
    esMaestra: boolean;
    maestraId: number;
    fechaCompra: string | null;
    saldoUnificado: number;
    numeroCuotas: number;
    tasaMensual: number;
    cuotaMensual: number;
    sistemaAmortizacion: string;
    absorbidasCount: number;
  } | null;
  recurrencia: {
    id: number;
    plantillaId: number;
    nombre: string;
    frecuencia: string | null;
    montoBaseEstimado: number;
    ultimoPeriodo: string | null;
    activa: boolean;
  } | null;
  estadisticasComercio: {
    comercioCanonico: string;
    totalHistoricoAnio: number;
    cantidadComprasAnio: number;
    gastoMesTarjeta: number;
    porcentajeSobreGastoMesTarjeta: number;
  };
  resumenPagoUnico: {
    esUnaCuota: boolean;
    fechaTransaccion: string | null;
    fechaEstimadaPagoExtracto: string | null;
    costoFinanciero: number;
    gastoMesTarjeta: number;
    porcentajeSobreGastoMesTarjeta: number;
  };
}

export type SortableFields = 'id' | 'concepto' | 'valorCompra' | 'fechaCompra' | 'numeroCuotas' |
'fechaUltimaCuota' | 'pagoMensual' | 'interes' | 'descripcion' | 'estado' | 'tarjeta' | 'responsables';

export interface ColumnasCompraCredito {
  columna: SortableFields;
  titulo: string;
}

export interface CuotaDetalle {
  id?: number;
  numeroCuota?: number;
  fechaPago?: Date;
  saldoRestante?: number;
  interesPagado?: number;
  aporteCapital?: number;
  pagoTotal?: number;
  compra?: number;
  estado?: string | null;
  estadoReal?: EstadoRealCuota;
  /** Mes de facturación (`YYYY-MM`) calculado por la BD según el día de corte de la tarjeta. */
  periodoFacturacion?: string | null;
}

export interface ResponsableCompraCredito {
  id?: number;
  fechaCreacion?: Date;
  persona?: number;
  porcentajePago: number;
  cantidadPago: number;
  cantidadCuotas: number;
  comprasCredito?: number;
}

export interface MesPagoTarjeta {
  valorPago: number;
  tarjeta: number;
  fechaPago: Date;
}

export interface BalanceTarjeta {
  tarjeta: number;
  franquicia: string;
  total_saldo_restante: number;
}

export const months = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// ───────── Fase 2 (Iteración 3): Propagación Inteligente a Compras Similares ─────────

export interface CompraSimilarCandidata {
  id: number;
  concepto: string;
  descripcion: string;
  fechaCompra: string | null;
  valorTotal: number;
  numeroCuotasActual: number;
  responsablesActuales: Array<{ personaId: number | null; nombre: string; porcentajePago: number }>;
  tagsActuales: string[];
  comercioCanonicoActual: string | null;
  tarjetaNombre: string;
  diferenciasDetectadas: string[];
}

export interface ResultadoBusquedaSimilares {
  compraOrigen: {
    id: number;
    concepto: string;
    comercioCanonico: string | null;
    numeroCuotas: number;
    tags: string[];
    responsables: Array<{ personaId: number | null; nombre: string; porcentajePago: number }>;
  };
  candidatas: CompraSimilarCandidata[];
}

export interface PropagarEdicionSimilaresPayload {
  compraOrigenId: number;
  compraDestinoIds: number[];
  aplicarCuotas?: boolean;
  aplicarResponsables?: boolean;
  aplicarTags?: boolean;
  aplicarComercioCanonico?: boolean;
  modoTags?: 'MERGE' | 'REEMPLAZAR';
}

export interface ResultadoPropagacionSimilares {
  actualizadas: number;
  idsActualizados: number[];
  cuotasRecalculadas: number;
  responsablesReplicados: number;
}
