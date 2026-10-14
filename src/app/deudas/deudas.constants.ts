import { EstadoCuentaPersona, TipoMovimientoDeuda } from '../modelos/erp';
import { sumarMonedas } from '../shared/dinero.helper';

const ETIQUETAS: Record<TipoMovimientoDeuda, string> = {
  CARGO_CUOTA_TC: 'Cuota de tarjeta',
  CARGO_GASTO_COMPARTIDO: 'Gasto compartido',
  CARGO_PRESTAMO_DIRECTO: 'Préstamo',
  CARGO_CRUCE_DEUDA: 'Cruce de deuda (cargo)',
  ABONO_PAGO_RECIBIDO: 'Pago recibido',
  ABONO_APORTE_DIARIO: 'Aporte diario',
  ABONO_CRUCE_DEUDA: 'Cruce de deuda (abono)',
};

export function etiquetaMovimiento(tipo: string | null | undefined): string {
  return ETIQUETAS[tipo as TipoMovimientoDeuda] ?? (tipo || 'Movimiento');
}

export function esAbono(tipo: string | null | undefined): boolean {
  return (tipo ?? '').startsWith('ABONO_');
}

export interface TotalesEstadoCuenta {
  cuotasTc: number;
  recurrentes: number;
  prestamos: number;
  cruces: number;
  abonos: number;
  netoMes: number;
  saldoAcumulado: number;
}

/** Totales de cada columna del estado de cuenta (suma exacta en centavos; los nulos cuentan como 0). */
export function totalesEstadoCuenta(filas: EstadoCuentaPersona[]): TotalesEstadoCuenta {
  const suma = (f: (x: EstadoCuentaPersona) => number | null) => sumarMonedas(filas.map(f));
  return {
    cuotasTc: suma((x) => x.cuotas_tc_mes),
    recurrentes: suma((x) => x.recurrentes_compartidos_mes),
    prestamos: suma((x) => x.prestamos_mes),
    cruces: suma((x) => x.cruces_asumidos_mes),
    abonos: suma((x) => x.abonos_recibidos_mes),
    netoMes: suma((x) => x.saldo_neto_mes),
    saldoAcumulado: suma((x) => x.saldo_total_acumulado),
  };
}

/** Personas con saldo distinto de cero o movimientos en el mes (las demás son ruido en el estado de cuenta). */
export function tieneActividad(f: EstadoCuentaPersona): boolean {
  return [f.cuotas_tc_mes, f.recurrentes_compartidos_mes, f.prestamos_mes, f.cruces_asumidos_mes, f.abonos_recibidos_mes, f.saldo_neto_mes, f.saldo_total_acumulado].some(
    (v) => Number(v ?? 0) !== 0
  );
}

export function iniciales(nombre: string | null | undefined, guardadas?: string | null): string {
  if (guardadas && guardadas.trim()) return guardadas.trim().slice(0, 2).toUpperCase();
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase();
}
