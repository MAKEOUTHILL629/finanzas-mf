/** Contratos de `/api/recurrentes/radar` (Fase 3). */
export interface CandidatoRecurrente {
  clave: string;
  comercio: string;
  cargos: number;
  frecuencia: 'MENSUAL' | 'ANUAL' | 'QUINCENAL';
  intervaloMedianoDias: number;
  montoPromedio: number;
  ultimoMonto: number;
  coeficienteVariacion: number;
  tipoMonto: 'MONTO_FIJO_COP' | 'MONTO_VARIABLE_TRM_O_CONSUMO';
  primeraFecha: string;
  ultimaFecha: string;
  proximaFechaEstimada: string;
  incrementoTarifa: boolean;
  montoMensualizado: number;
  estadoDetectado: 'NUEVA_SUSCRIPCION_DETECTADA' | 'REGISTRADA' | 'PENDIENTE_CANCELACION';
  alertaProxima: boolean;
}

export interface ResultadoRadar {
  mesesVentana: number;
  candidatos: CandidatoRecurrente[];
  kpis: {
    gastoMensualDetectado: number;
    impactoAnualProyectado: number;
    suscripcionesOcultas: number;
    totalDetectadas: number;
  };
}
