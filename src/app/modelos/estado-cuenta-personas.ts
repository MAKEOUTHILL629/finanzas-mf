import { BloqueLiquidacion } from './aportes';
import { Periodo } from './erp';

/** `GET /api/personas/estado-cuenta` · `GET /api/personas/:id/estado-cuenta` (deuda unificada por persona). */

export type EstadoDeudaPersona = 'DEBE' | 'A_FAVOR' | 'PAZ_Y_SALVO';
export type EstadoCuotaPersona = 'PAGADA' | 'PARCIAL' | 'PENDIENTE';

export interface PersonaBasica {
  id: number;
  nombre: string | null;
  iniciales: string | null;
  color: string | null;
}

/** Lo que una persona debe por las compras de una tarjeta. */
export interface DesgloseTarjeta {
  tarjetaId: number | null;
  tarjeta: string | null;
  /** Cuotas de este mes. */
  totalMes: number;
  /** Cuotas de los meses siguientes. */
  porVencer: number;
  numeroCompras: number;
  /** Solo en el detalle de una persona. */
  compras?: CompraDePersona[];
}

export interface CuotaDelMes {
  numero: number;
  monto: number;
  fechaPago: string;
  estado: EstadoCuotaPersona;
  cubierto: number;
  pendiente: number;
}

export interface CompraDePersona {
  compraId: number;
  concepto: string | null;
  fechaCompra: string | null;
  valorCompra: number;
  numeroCuotasCompra: number;
  /** Cuántas cuotas le tocan a la persona (las primeras N). */
  cuotasDeLaPersona: number;
  porcentaje: number;
  /** Últimos 4 dígitos del plástico con el que se hizo la compra. */
  plastico: string | null;
  cuotaDelMes: CuotaDelMes | null;
  restantes: { cuotas: number; monto: number };
}

export interface ResumenPersona {
  persona: PersonaBasica;
  periodo: Periodo;
  /** Todo lo que se le cobra por este mes (tarjetas, préstamos, recurrentes, cobros puntuales y cruces). */
  pagoDelMes: number;
  /** De ese total, lo que viene de compras con tarjeta. */
  pagoDelMesTarjetas: number;
  abonosDelMes: number;
  saldoAnterior: number;
  /** Lo que debe pagar ahora (saldo anterior + este mes − abonos); negativo = saldo a favor. */
  saldoExigible: number;
  aPagarAhora: number;
  porVencer: number;
  porVencerTarjetas: number;
  /** Lo exigible ahora + lo que aún no vence. */
  deudaTotal: number;
  estado: EstadoDeudaPersona;
  /** Cuotas de meses anteriores que no tienen asiento: no se suman al saldo, se avisan. */
  historicoSinCargar: { cuotas: number; monto: number };
  tieneActividad: boolean;
  porTarjeta: DesgloseTarjeta[];
}

export interface TotalesEstadoCuentaPersonas {
  pagoDelMes: number;
  aPagarAhora: number;
  porVencer: number;
  deudaTotal: number;
  historicoSinCargar: { cuotas: number; monto: number };
}

export interface EstadoCuentaPersonas {
  periodo: Periodo;
  personas: ResumenPersona[];
  totales: TotalesEstadoCuentaPersonas;
}

export interface CuotaAnteriorPendiente {
  compraId: number;
  concepto: string | null;
  tarjeta: string | null;
  periodo: Periodo;
  numeroCuota: number;
  cuotasDeLaCompra: number;
  monto: number;
  estado: EstadoCuotaPersona;
  pendiente: number;
}

export interface DetalleEstadoCuentaPersona extends ResumenPersona {
  desglosePorTarjeta: DesgloseTarjeta[];
  cuotasAnterioresPendientes: CuotaAnteriorPendiente[];
  /** Lo que se le cobra además de las cuotas de tarjeta (cada bloque con sus ítems y subtotal). */
  otrosCargos: {
    prestamos?: BloqueLiquidacion;
    recurrentes?: BloqueLiquidacion;
    cobrosPuntuales?: BloqueLiquidacion;
    cruces?: BloqueLiquidacion;
    saldoAFavorAplicado?: BloqueLiquidacion;
    otros?: BloqueLiquidacion;
  };
  abonos: BloqueLiquidacion;
  faltanteObligacion: number;
  /** Abonos que sobran después de saldar todos los cargos (saldo a favor). */
  sobranteDeAbonos: number;
}
