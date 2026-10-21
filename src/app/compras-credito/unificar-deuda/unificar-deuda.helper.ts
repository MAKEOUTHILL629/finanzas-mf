import { CandidataRefinanciamiento, PedidoBarridoFecha, PedidoRefinanciamiento } from '../../modelos/refinanciamiento';
import { cuotaFrancesa, tasaMensualDeEntrada } from '../../shared/amortizacion-francesa.helper';
import { sumarMonedas } from '../../shared/dinero.helper';

/** Lógica pura del asistente «Unificar deuda»: totales de lo elegido, la cuota estimada y el pedido que se manda al servidor. */

export type TipoTasa = 'mensual' | 'anual';

export interface TotalesSeleccion {
  cantidad: number;
  /** Capital que falta por pagar de lo elegido: lo que se refinancia. */
  saldo: number;
  /** Lo que se paga hoy cada mes por esas compras. */
  cuotaActual: number;
  /** Lo que faltaría pagar sin refinanciar (con intereses). */
  restante: number;
}

export function totalesDeSeleccion(candidatas: ReadonlyArray<CandidataRefinanciamiento>, ids: ReadonlySet<number> | ReadonlyArray<number>): TotalesSeleccion {
  const elegidas = new Set(ids);
  const lista = candidatas.filter((c) => elegidas.has(c.id));
  return {
    cantidad: lista.length,
    saldo: sumarMonedas(lista.map((c) => c.saldoCapital)),
    cuotaActual: sumarMonedas(lista.map((c) => c.cuotaProxima)),
    restante: sumarMonedas(lista.map((c) => c.restantePorPagar)),
  };
}

/** Lo que la persona escribió en el paso 2. */
export interface EntradaSimulacion {
  tarjetaId: number | null;
  compraIds: ReadonlyArray<number>;
  numeroCuotas: number | null;
  tipoTasa: TipoTasa;
  /** % mensual o efectivo anual, según `tipoTasa`. */
  tasa: number | null;
  /** La cuota que dio el banco (solo cuenta si `cuotaPactada`). */
  cuotaMensual: number | null;
  /** La persona escribió la cuota a mano (con seguros o ajustes): manda sobre la calculada. */
  cuotaPactada: boolean;
  fecha?: string | null;
}

const enteroValido = (n: number | null): n is number => n !== null && Number.isInteger(n) && n >= 1 && n <= 120;

/** Cuota que saldría con la fórmula francesa y la tasa escrita (`null` si falta algo o no es válido). */
export function cuotaEstimada(saldo: number, numeroCuotas: number | null, tipoTasa: TipoTasa, tasa: number | null): number | null {
  if (!enteroValido(numeroCuotas)) return null;
  const mensual = tasaMensualDeEntrada(tipoTasa, tasa);
  return mensual === null ? null : cuotaFrancesa(saldo, mensual, numeroCuotas);
}

/** El cuerpo de `POST /refinanciamientos/simular`; `null` mientras falte lo mínimo (compras, cuotas y tasa o cuota). */
export function pedidoDeSimulacion(e: EntradaSimulacion): PedidoRefinanciamiento | null {
  if (e.tarjetaId === null || e.compraIds.length === 0 || !enteroValido(e.numeroCuotas)) return null;
  const dioTasa = e.tasa !== null && tasaMensualDeEntrada(e.tipoTasa, e.tasa) !== null;
  const dioCuota = e.cuotaPactada && e.cuotaMensual !== null && e.cuotaMensual > 0;
  if (!dioTasa && !dioCuota) return null;
  const pedido: PedidoRefinanciamiento = { tarjetaId: e.tarjetaId, compraIds: [...e.compraIds], numeroCuotas: e.numeroCuotas };
  if (dioTasa) {
    if (e.tipoTasa === 'anual') pedido.tasaEfectivaAnual = e.tasa as number;
    else pedido.tasaMensual = e.tasa as number;
  }
  if (dioCuota) pedido.cuotaMensual = e.cuotaMensual as number;
  if (e.fecha) pedido.fecha = e.fecha;
  return pedido;
}

/** Lo que la persona escribió para el barrido por fecha de corte. */
export interface EntradaBarrido {
  tarjetaIds: ReadonlyArray<number>;
  fechaCorte: string | null;
  /** Valor total unificado por el banco ($X). */
  montoUnificadoBanco: number | null;
  numeroCuotas: number | null;
  tipoTasa: TipoTasa;
  tasa: number | null;
  cuotaMensual: number | null;
  cuotaPactada: boolean;
}

/** El cuerpo de `POST /refinanciamientos/simular-barrido-fecha`; `null` mientras falte lo mínimo. */
export function pedidoDeBarrido(e: EntradaBarrido): PedidoBarridoFecha | null {
  if (e.tarjetaIds.length === 0 || !e.fechaCorte || !enteroValido(e.numeroCuotas)) return null;
  if (e.montoUnificadoBanco === null || !(e.montoUnificadoBanco > 0)) return null;
  const dioTasa = e.tasa !== null && tasaMensualDeEntrada(e.tipoTasa, e.tasa) !== null;
  const dioCuota = e.cuotaPactada && e.cuotaMensual !== null && e.cuotaMensual > 0;
  if (!dioTasa && !dioCuota) return null;
  const pedido: PedidoBarridoFecha = {
    tarjetaIds: [...e.tarjetaIds],
    fechaCorte: e.fechaCorte,
    montoUnificadoBanco: e.montoUnificadoBanco,
    numeroCuotas: e.numeroCuotas,
  };
  if (dioTasa) {
    if (e.tipoTasa === 'anual') pedido.tasaEfectivaAnual = e.tasa as number;
    else pedido.tasaMensual = e.tasa as number;
  }
  if (dioCuota) pedido.cuotaMensual = e.cuotaMensual as number;
  return pedido;
}

export interface LecturaDiferencia {
  tono: 'ahorro' | 'aumento' | 'igual';
  /** «Pagarías $X menos cada mes» / «Pagarías $X más cada mes» / «Pagarías lo mismo cada mes». */
  verbo: string;
  /** Valor absoluto. */
  monto: number;
}

/** Cómo leer la diferencia entre lo que se paga hoy y lo que se pagaría (positivo = se libera plata). */
export function lecturaDiferenciaMensual(diferencia: number): LecturaDiferencia {
  const monto = Math.abs(Math.round(diferencia * 100) / 100);
  if (monto < 0.005) return { tono: 'igual', verbo: 'Pagarías lo mismo cada mes', monto: 0 };
  return diferencia > 0 ? { tono: 'ahorro', verbo: 'Pagarías menos cada mes', monto } : { tono: 'aumento', verbo: 'Pagarías más cada mes', monto };
}

/** Lo mismo para todo el plazo (positivo = se paga menos en total que sin refinanciar). */
export function lecturaDiferenciaTotal(diferencia: number): LecturaDiferencia {
  const monto = Math.abs(Math.round(diferencia * 100) / 100);
  if (monto < 0.005) return { tono: 'igual', verbo: 'Costaría lo mismo', monto: 0 };
  return diferencia > 0 ? { tono: 'ahorro', verbo: 'Pagarías menos en total', monto } : { tono: 'aumento', verbo: 'Pagarías más en total', monto };
}
