import { EstadoTransaccion, Transaccion, TipoTransaccion } from '../modelos/erp';
import { sumarMonedas } from '../shared/dinero.helper';

export interface ReglasTipo {
  valor: TipoTransaccion;
  etiqueta: string;
  icono: string;
  /** +1 suma al saldo de la cuenta destino, −1 resta de la cuenta origen, 0 mueve entre cuentas. */
  signo: 1 | -1 | 0;
  requiereOrigen: boolean;
  requiereDestino: boolean;
  requiereTarjeta: boolean;
}

/** Espejo de `validarReglasTransaccion` del backend (el servidor sigue siendo quien decide). */
export const TIPOS_TRANSACCION: readonly ReglasTipo[] = [
  { valor: 'EGRESO', etiqueta: 'Egreso', icono: 'trending_down', signo: -1, requiereOrigen: true, requiereDestino: false, requiereTarjeta: false },
  { valor: 'INGRESO', etiqueta: 'Ingreso', icono: 'trending_up', signo: 1, requiereOrigen: false, requiereDestino: true, requiereTarjeta: false },
  { valor: 'TRANSFERENCIA', etiqueta: '⇄ Transferencia entre mis cuentas', icono: 'sync_alt', signo: 0, requiereOrigen: true, requiereDestino: true, requiereTarjeta: false },
  { valor: 'PAGO_TARJETA', etiqueta: 'Pago de tarjeta', icono: 'credit_score', signo: -1, requiereOrigen: true, requiereDestino: false, requiereTarjeta: true },
  { valor: 'PAGO_PRESTAMO', etiqueta: 'Pago de préstamo', icono: 'payments', signo: -1, requiereOrigen: true, requiereDestino: false, requiereTarjeta: false },
  { valor: 'REEMBOLSO_TERCERO', etiqueta: 'Reembolso de tercero', icono: 'undo', signo: 1, requiereOrigen: false, requiereDestino: true, requiereTarjeta: false },
];

export const ESTADOS_TRANSACCION: ReadonlyArray<{ valor: EstadoTransaccion; etiqueta: string }> = [
  { valor: 'CONFIRMADO', etiqueta: 'Confirmado' },
  { valor: 'PENDIENTE_REVISION', etiqueta: 'Pendiente de revisión' },
  { valor: 'ANULADO', etiqueta: 'Anulado' },
];

export function reglasDeTipo(tipo: string | null | undefined): ReglasTipo {
  return TIPOS_TRANSACCION.find((t) => t.valor === tipo) ?? TIPOS_TRANSACCION[0];
}

export function etiquetaEstadoTransaccion(estado: string | null | undefined): string {
  return ESTADOS_TRANSACCION.find((e) => e.valor === estado)?.etiqueta ?? (estado || '—');
}

export function claseEstadoTransaccion(estado: string | null | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  return estado === 'CONFIRMADO' ? 'success' : estado === 'PENDIENTE_REVISION' ? 'warning' : estado === 'ANULADO' ? 'danger' : 'neutral';
}

/** Efecto firmado de la transacción sobre el patrimonio: ingresos (+), egresos (−) y transferencias o espejos internos (0). */
export function efectoDe(t: Pick<Transaccion, 'tipo_transaccion' | 'monto_cop' | 'es_transferencia_interna'>): number {
  if (t.es_transferencia_interna) return 0;
  return reglasDeTipo(t.tipo_transaccion).signo * Number(t.monto_cop);
}

export interface TotalesTransacciones {
  ingresos: number;
  egresos: number;
  neto: number;
  pendientesRevision: number;
  transferenciasInternas?: number;
}

/** Solo cuentan las CONFIRMADAS (como el Trigger 2 de la BD); las transferencias y los movimientos internos entre cuentas propias no son ingreso ni egreso. */
export function totalesDe(items: Transaccion[]): TotalesTransacciones {
  const confirmadas = items.filter((t) => t.estado === 'CONFIRMADO' && !t.es_transferencia_interna);
  const ingresos = sumarMonedas(confirmadas.filter((t) => reglasDeTipo(t.tipo_transaccion).signo === 1).map((t) => t.monto_cop));
  const egresos = sumarMonedas(confirmadas.filter((t) => reglasDeTipo(t.tipo_transaccion).signo === -1).map((t) => t.monto_cop));
  return {
    ingresos,
    egresos,
    neto: sumarMonedas([ingresos, -egresos]),
    pendientesRevision: items.filter((t) => t.estado === 'PENDIENTE_REVISION').length,
  };
}
