import { BloqueLiquidacion, EstadoLiquidacion, ItemLiquidacion, LiquidacionPersona, OrigenMovimiento } from '../modelos/aportes';
import { EstadoCuentaPersona } from '../modelos/erp';
import { moneda } from '../shared/moneda.util';

export type ClaveBloque = 'cuotasTarjetas' | 'cuotasPrestamos' | 'cargosRecurrentes' | 'cobrosPuntuales' | 'crucesCuentas' | 'saldoAFavorAplicado' | 'abonosRealizados' | 'otros';

export interface DefinicionBloque {
  clave: ClaveBloque;
  titulo: string;
  icono: string;
}

/** Los bloques del desglose de una persona, en el orden de la especificación. */
export const BLOQUES: DefinicionBloque[] = [
  { clave: 'cuotasTarjetas', titulo: 'Compras / cuotas de tarjeta de crédito', icono: 'credit_card' },
  { clave: 'cuotasPrestamos', titulo: 'Cuotas de préstamos', icono: 'account_balance_wallet' },
  { clave: 'cargosRecurrentes', titulo: 'Pagos y cargos recurrentes del mes', icono: 'autorenew' },
  { clave: 'cobrosPuntuales', titulo: 'Servicios, mercado y eventos del mes', icono: 'call_split' },
  { clave: 'crucesCuentas', titulo: 'Cruces de cuentas del mes', icono: 'compare_arrows' },
  { clave: 'saldoAFavorAplicado', titulo: 'Saldo a favor de la cuota aplicado', icono: 'savings' },
  { clave: 'abonosRealizados', titulo: 'Abonos realizados en el mes', icono: 'payments' },
  { clave: 'otros', titulo: 'Otros movimientos', icono: 'more_horiz' },
];

const ETIQUETA_ORIGEN: Record<OrigenMovimiento, string> = {
  COMPRA_CREDITO: 'Tarjeta',
  PRESTAMO: 'Préstamo',
  RECURRENTE_COMPARTIDO: 'Gasto compartido',
  RECURRENTE_PERSONA: 'Recurrente',
  COBRO_PUNTUAL: 'Gasto repartido',
  CRUCE_APORTE_CARRO: 'Aporte del carro',
  CRUCE_ENTRE_PERSONAS: 'Cruce entre personas',
  SALDO_A_FAVOR_CARRO: 'Saldo a favor del carro',
  PAGO_RECIBIDO: 'Pago recibido',
  DESCUENTO: 'Descuento del propietario',
  OTRO: 'Movimiento',
};

export function etiquetaOrigen(origen: OrigenMovimiento | string): string {
  return ETIQUETA_ORIGEN[origen as OrigenMovimiento] ?? 'Movimiento';
}

/** Bloques que tienen movimientos (los vacíos no se muestran). */
export function bloquesConItems(l: LiquidacionPersona): Array<DefinicionBloque & { bloque: BloqueLiquidacion }> {
  // `?? vacío`: un backend anterior a los cobros puntuales no envía ese bloque.
  return BLOQUES.map((d) => ({ ...d, bloque: l[d.clave] ?? { items: [], subtotal: 0 } })).filter((b) => b.bloque.items.length > 0);
}

/** «Andrés te debe $X este mes» / «Tienes un saldo a favor de Andrés por $X este mes» / «Paz y salvo en el mes». */
export function mensajeLiquidacion(nombre: string | null | undefined, saldoNeto: number, estado: EstadoLiquidacion): string {
  const quien = (nombre ?? 'La persona').trim() || 'La persona';
  if (estado === 'DEBE') return `${quien} te debe ${moneda(saldoNeto)} este mes`;
  if (estado === 'A_FAVOR') return `Tienes un saldo a favor de ${quien} por ${moneda(Math.abs(saldoNeto))} este mes`;
  return 'Paz y salvo en el mes';
}

export function claseEstadoLiquidacion(estado: EstadoLiquidacion): 'danger' | 'success' | 'info' {
  return estado === 'DEBE' ? 'danger' : estado === 'A_FAVOR' ? 'success' : 'info';
}

export function etiquetaEstadoLiquidacion(estado: EstadoLiquidacion): string {
  return estado === 'DEBE' ? 'Te debe' : estado === 'A_FAVOR' ? 'A favor' : 'Paz y salvo';
}

/** Cuánto debe ahora la persona (para sugerir el monto de un pago): lo acumulado si es positivo, si no, nada. */
export function montoSugeridoPago(l: Pick<LiquidacionPersona, 'saldoTotalAcumulado' | 'resumenNeto'>): number | null {
  const pendiente = Math.max(l.saldoTotalAcumulado, l.resumenNeto.saldoNetoFinal);
  return pendiente > 0 ? Math.round(pendiente * 100) / 100 : null;
}

/** El formulario de abono del estado de cuenta espera la fila del ledger: se arma con lo que ya conoce la liquidación. */
export function adaptarParaAbono(l: LiquidacionPersona): EstadoCuentaPersona {
  return {
    persona_id: l.persona.id,
    nombre: l.persona.nombre,
    iniciales_nombre: l.persona.iniciales,
    color_representativo: l.persona.color,
    cuotas_tc_mes: l.cuotasTarjetas.subtotal,
    recurrentes_compartidos_mes: l.cargosRecurrentes.subtotal + l.cobrosPuntuales.subtotal,
    prestamos_mes: l.cuotasPrestamos.subtotal,
    cruces_asumidos_mes: l.crucesCuentas.subtotal,
    abonos_recibidos_mes: l.abonosRealizados.subtotal,
    saldo_neto_mes: l.resumenNeto.saldoNetoFinal,
    saldo_total_acumulado: montoSugeridoPago(l),
  };
}

/** Impacto con signo para la tabla: los cargos suman, los abonos restan (con paréntesis en la moneda). */
export function clasePorSigno(item: Pick<ItemLiquidacion, 'signo'>): string {
  return item.signo < 0 ? 'erp-gain' : '';
}

export function personasConActividad(personas: LiquidacionPersona[]): LiquidacionPersona[] {
  return personas.filter((p) => p.tieneActividad);
}
