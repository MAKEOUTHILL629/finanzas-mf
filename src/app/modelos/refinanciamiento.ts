/**
 * Refinanciamiento / unificación de deuda de una tarjeta (plan V2, fase 5). Los tipos reflejan `/api/refinanciamientos`:
 * el backend serializa los decimales como `number` y las fechas como texto ISO.
 */

/** Una compra pendiente de la tarjeta que se podría unificar, con lo que le falta por pagar. */
export interface CandidataRefinanciamiento {
  id: number;
  concepto: string | null;
  fechaCompra: string | null;
  valorCompra: number;
  numeroCuotas: number;
  interes: number;
  plasticoUltimos4: string | null;
  /** La compra ya es una unificación anterior (se puede volver a refinanciar). */
  esRefinanciamiento: boolean;
  cuotasPendientes: number;
  /** Capital que todavía no se ha pagado. */
  saldoCapital: number;
  /** Lo que falta por pagar contando intereses. */
  restantePorPagar: number;
  cuotaProxima: number;
  proximoPeriodo: string | null;
  responsables: Array<{ personaId: number; porcentaje: number }>;
}

export interface CuotaSimulada {
  numeroCuota: number;
  fechaPago: string;
  saldoRestante: number;
  interesPagado: number;
  aporteCapital: number;
  pagoTotal: number;
  estado: string;
  periodoFacturacion: string;
}

export interface ResultadoSimulacion {
  saldo: number;
  numeroCuotas: number;
  /** Tasa con la que se arma la tabla: la informada o, con una cuota pactada, la que esa cuota implica. */
  tasaMensualPct: number;
  tasaEfectivaAnualPct: number;
  /** Lo que dijo el asesor (mensual); `null` si solo dio la cuota. */
  tasaInformadaPct: number | null;
  /** Cuota que sale de la fórmula con la tasa informada (`null` si no se informó tasa). */
  cuotaCalculada: number | null;
  /** Cuota con la que de verdad se arma la tabla (la pactada, si la hay). */
  cuotaUsada: number;
  cuotaPactada: number | null;
  totalAPagar: number;
  interesTotal: number;
  cuotaActualCombinada: number;
  /** Cuota actual − nueva cuota: lo que se libera cada mes (negativo si la cuota sube). */
  diferenciaMensual: number;
  restantePorPagar: number;
  /** Lo que faltaba pagar − lo que se pagará: el ahorro (o sobrecosto, si es negativo) de todo el plazo. */
  diferenciaTotal: number;
  cuotas: CuotaSimulada[];
}

export interface ResponsableDeMaestra {
  personaId: number;
  /** % de la nueva obligación. */
  porcentaje: number;
  /** Su parte del saldo unificado. */
  monto: number;
}

export interface SimulacionRefinanciamiento {
  tarjetaId: number;
  compraIds: number[];
  cuotaActualCombinada: number;
  resultado: ResultadoSimulacion;
  responsables: ResponsableDeMaestra[];
}

export interface CompraAbsorbida {
  id: number;
  concepto: string | null;
  fechaCompra: string | null;
  valorCompra: number;
  numeroCuotas: number;
  estado: string | null;
  /** Capital pendiente que se llevó la obligación nueva. */
  saldoRefinanciado: number;
  esRefinanciamiento: boolean;
}

export interface DetalleRefinanciamiento {
  id: number;
  concepto: string | null;
  /** Sí = la compra consultada ES la obligación nueva; no = es una compra absorbida por `maestraId`. */
  esMaestra: boolean;
  maestraId: number | null;
  fechaCompra: string | null;
  saldoUnificado: number;
  numeroCuotas: number;
  tasaMensual: number;
  cuotaMensual: number;
  cuotaPactada: number | null;
  /** `CAPITAL_FIJO` (histórico, registrado a mano) | `FRANCES` (creado por el asistente). */
  sistemaAmortizacion: string;
  tarjetaId: number | null;
  absorbidas: CompraAbsorbida[];
}

/** Lo que se envía a simular / ejecutar. Una sola de `tasaMensual` / `tasaEfectivaAnual`, o solo `cuotaMensual`. */
export interface PedidoRefinanciamiento {
  tarjetaId: number;
  compraIds: number[];
  numeroCuotas: number;
  /** Tasa mensual vencida (M.V.) en %. */
  tasaMensual?: number;
  /** Tasa efectiva anual (E.A.) en %. */
  tasaEfectivaAnual?: number;
  /** La cuota exacta que dio el banco (con seguros): manda sobre la calculada. */
  cuotaMensual?: number;
  /** `yyyy-MM-dd`; por defecto hoy (Bogotá). */
  fecha?: string;
}

export interface EjecutarRefinanciamientoPedido extends PedidoRefinanciamiento {
  concepto?: string;
  descripcion?: string;
}

export interface ResultadoEjecucion extends DetalleRefinanciamiento {
  simulacion: SimulacionRefinanciamiento;
}
