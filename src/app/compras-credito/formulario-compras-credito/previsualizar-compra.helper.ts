/**
 * Vista previa de una compra a crédito mientras se llena el formulario: lo que costará, en cuántas cuotas y desde cuándo.
 *
 * Es una ESTIMACIÓN que repite las reglas de `calcularAmortizacion` del backend (`common/utils/calculadora-amortizacion.util.ts`) para una compra nueva:
 *  · capital fijo por cuota (valor ÷ cuotas) e interés mensual sobre el saldo antes de pagar la cuota;
 *  · la 1.ª cuota NO cobra interés: ese mes se acumula y se paga en la 2.ª (con una sola cuota no hay interés);
 *  · cada cuota vence el último día del mes: la 1.ª en el mes de la compra si el día es ≤ día de corte de la tarjeta (15 si no tiene), si no en el siguiente.
 * La tabla real la calcula y guarda el servidor al registrar la compra (con Decimal): ante cualquier diferencia manda el servidor.
 * Aquí se usa coma flotante, así que los totales pueden desviarse unos centavos en planes largos: la pantalla los muestra en pesos enteros.
 */

/** Día de corte que usa el servidor cuando la tarjeta no tiene uno configurado. */
export const DIA_CORTE_POR_DEFECTO = 15;

export interface EntradaPrevisualizacion {
  /** Valor de la compra en COP. */
  valor: number;
  numeroCuotas: number;
  /** Interés mensual en % (1.8895 = 1,8895 %). */
  interesMensual: number;
  /** `yyyy-MM-dd`. */
  fechaCompra: string;
  /** Día de corte de la tarjeta (`null` si no tiene). */
  diaCorte: number | null;
}

export interface PrevisualizacionCompra {
  numeroCuotas: number;
  /** Lo que se paga de cuota en cada mes, en orden (ya redondeado a centavos como en el servidor). */
  pagos: number[];
  interesesTotales: number;
  /** Valor de la compra más los intereses. */
  total: number;
  /** Total ÷ cuotas: las cuotas no son iguales (la 1.ª no lleva interés y la 2.ª lleva dos meses). */
  promedioPorCuota: number;
  /** `yyyy-MM-dd` */
  fechaPrimerPago: string;
  /** `yyyy-MM-dd` */
  fechaUltimoPago: string;
}

const centavos = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/** Último día del mes `mes` (1–12) del año `anio`, en UTC para que la zona horaria no mueva el día. */
function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function siguienteMes(p: { anio: number; mes: number }): { anio: number; mes: number } {
  return p.mes === 12 ? { anio: p.anio + 1, mes: 1 } : { anio: p.anio, mes: p.mes + 1 };
}

function aIso(p: { anio: number; mes: number }): string {
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${p.anio}-${dos(p.mes)}-${dos(ultimoDiaDelMes(p.anio, p.mes))}`;
}

/** `null` si falta algún dato o no tiene sentido (no hay vista previa que mostrar). */
export function previsualizarCompra(e: EntradaPrevisualizacion): PrevisualizacionCompra | null {
  const { valor, numeroCuotas, interesMensual } = e;
  if (!Number.isFinite(valor) || valor <= 0) return null;
  if (!Number.isInteger(numeroCuotas) || numeroCuotas < 1) return null;
  if (!Number.isFinite(interesMensual) || interesMensual < 0) return null;
  const partes = FECHA_ISO.exec(e.fechaCompra ?? '');
  if (!partes) return null;
  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > ultimoDiaDelMes(anio, mes)) return null;

  const limite = e.diaCorte && e.diaCorte > 0 ? e.diaCorte : DIA_CORTE_POR_DEFECTO;
  let vence = dia <= limite ? { anio, mes } : siguienteMes({ anio, mes });
  const fechaPrimerPago = aIso(vence);

  const tasa = interesMensual / 100;
  const capital = valor / numeroCuotas;
  const pagos: number[] = [];
  let saldo = valor;
  let interesAcumulado = 0;
  let interesesTotales = 0;

  for (let k = 1; k <= numeroCuotas; k += 1) {
    const interesDelMes = saldo * tasa;
    let interesPagado: number;
    let nuevoAcumulado = 0;
    if (k === 1) {
      interesPagado = 0;
      nuevoAcumulado = interesDelMes;
    } else if (interesAcumulado > 0) {
      interesPagado = interesAcumulado + interesDelMes;
    } else {
      interesPagado = interesDelMes;
    }
    interesesTotales += centavos(interesPagado);
    pagos.push(centavos(capital + interesPagado));
    saldo -= capital;
    interesAcumulado = nuevoAcumulado;
    if (k < numeroCuotas) vence = siguienteMes(vence);
  }

  const intereses = centavos(interesesTotales);
  const total = centavos(valor + intereses);
  return {
    numeroCuotas,
    pagos,
    interesesTotales: intereses,
    total,
    promedioPorCuota: centavos(total / numeroCuotas),
    fechaPrimerPago,
    fechaUltimoPago: aIso(vence),
  };
}
