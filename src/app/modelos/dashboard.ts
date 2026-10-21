import { Periodo } from './erp';

/** `GET /api/dashboard/summary?periodo=YYYY-MM`: todo lo que muestra la pantalla de inicio, en una sola llamada. */

export interface CuentaDashboard {
  id: number;
  nombre: string;
  tipo: string;
  moneda: string;
  saldo: number;
  esPrincipal: boolean;
}

export interface LiquidezDashboard {
  /** Saldo total de las cuentas activas en pesos. */
  total: number;
  moneda: string;
  otrasMonedas: Array<{ moneda: string; saldo: number }>;
  cuentas: CuentaDashboard[];
  numeroCuentas: number;
  patrimonioNeto: {
    valor: number;
    liquidez: number;
    porCobrar: number;
    deudaTarjetas: number;
  };
}

export interface FlujoMesDashboard {
  ingresos: number;
  egresosDirectos: number;
  tarjetas: number;
  recurrentes: number;
  porCobrarTerceros: number;
  desembolsoBruto: number;
  /** Lo que gastas tú: desembolso del mes menos lo que te reembolsan los terceros. */
  gastosPropios: number;
  flujoLibre: number;
  transferenciasInternas?: number;
}

export interface VencimientoDashboard {
  periodo: Periodo;
  /** `yyyy-MM-dd` */
  fecha: string;
  diasRestantes: number;
  monto: number;
  vencido: boolean;
}

export interface TarjetaDashboard {
  id: number;
  nombre: string;
  etiqueta: string;
  cupoTotal: number | null;
  cupoUtilizado: number;
  /** 0–100; `null` si la tarjeta no tiene cupo registrado. */
  porcentajeCupo: number | null;
  diaCorte: number | null;
  diaLimitePago: number | null;
  pagoDelMes: number;
  miParte: number;
  terceros: number;
  deudaPendiente: number;
  deudaPendienteMiParte: number;
  vencidoSinRegistrar: number;
  proximoVencimiento: VencimientoDashboard | null;
}

export interface DeudorDashboard {
  personaId: number;
  nombre: string | null;
  iniciales: string | null;
  color: string | null;
  pagoDelMes: number;
  aPagarAhora: number;
  porVencer: number;
  deudaTotal: number;
}

export interface MovimientoDashboard {
  id: number;
  /** ISO con zona. */
  fecha: string;
  concepto: string;
  tipo: string;
  monto: number;
  estado: string | null;
  cuenta: string | null;
}

export interface ResumenDashboard {
  periodo: Periodo;
  usuario: { nombre: string | null };
  generadoEn: string;
  liquidez: LiquidezDashboard;
  flujoMes: FlujoMesDashboard;
  tarjetas: {
    items: TarjetaDashboard[];
    totales: {
      pagoDelMes: number;
      miParte: number;
      terceros: number;
      deudaPendiente: number;
      vencidoSinRegistrar: number;
      cupoTotal: number;
      cupoUtilizado: number;
    };
  };
  porCobrar: {
    pagoDelMes: number;
    aPagarAhora: number;
    porVencer: number;
    deudaTotal: number;
    personasConDeuda: number;
    historicoSinCargar: { cuotas: number; monto: number };
    topDeudores: DeudorDashboard[];
  };
  proximosVencimientos: Array<VencimientoDashboard & { tarjetaId: number; tarjeta: string }>;
  movimientosRecientes: MovimientoDashboard[];
  alertas: { movimientosPorRevisar: number; correosPendientes: number; pagosPorAprobar: number };
}

// ── Iteración 2 — Fase 6: Analítica Avanzada Multi-Filtro ──

export type GranularidadAnalitica = 'DIA' | 'SEMANA' | 'MES';

export interface FiltroAnaliticaAvanzada {
  fechaInicio?: string;
  fechaFin?: string;
  granularidad?: GranularidadAnalitica;
  cuentaIds?: number[];
  tarjetaIds?: number[];
  categoriaIds?: number[];
  personaIds?: number[];
  soloGastoPropio?: boolean;
  incluirTransferenciasInternas?: boolean;
}

export interface PuntoSerieTemporal {
  periodo: string;
  ingresos: number;
  gastosPropios: number;
  gastosTerceros: number;
  ahorroNeto: number;
  transferenciasInternas: number;
  promedioMovilGastos: number;
}

export interface ComercioDistribuido {
  comercio: string;
  monto: number;
  porcentaje: number;
}

export interface CategoriaDistribuida {
  categoriaId: number | null;
  categoria: string;
  color: string;
  monto: number;
  porcentaje: number;
  variacionPct: number | null;
  comercios: ComercioDistribuido[];
}

export interface ProyeccionCuotaTarjetaMes {
  periodo: string;
  partePropia: number;
  parteTerceros: number;
  total: number;
  porTarjeta: Array<{
    tarjetaId: number;
    etiqueta: string;
    partePropia: number;
    parteTerceros: number;
    total: number;
    cupoTotal: number | null;
  }>;
}

export interface CeldaMapaCalorHabito {
  diaSemana: number;
  nombreDia: string;
  semanaMes: number;
  monto: number;
  cantidad: number;
}

export interface CascadaMensualDashboard {
  ingresos: number;
  gastosFijosRecurrentes: number;
  cuotasTarjetasPropias: number;
  gastosVariablesDirectos: number;
  prestamosNeto: number;
  flujoLibreReal: number;
}

export interface AnaliticaAvanzadaDashboard {
  filtrosAplicados: {
    fechaInicio: string;
    fechaFin: string;
    granularidad: GranularidadAnalitica;
    cuentaIds: number[];
    tarjetaIds: number[];
    categoriaIds: number[];
    personaIds: number[];
    soloGastoPropio: boolean;
    incluirTransferenciasInternas: boolean;
  };
  serieTemporal: PuntoSerieTemporal[];
  distribucionCategorias: CategoriaDistribuida[];
  proyeccionCuotasTarjetas: ProyeccionCuotaTarjetaMes[];
  mapaCalorHabitos: CeldaMapaCalorHabito[];
  balanceDeudasYPrestamos: {
    meDebenPrestamos: number;
    meDebenTercerosTarjetasYCruces: number;
    totalMeDeben: number;
    deboTarjetasPropias: number;
    deboPrestamosPasivos: number;
    totalDebo: number;
    posicionNeta: number;
  };
  cascadaMensual: CascadaMensualDashboard;
}
