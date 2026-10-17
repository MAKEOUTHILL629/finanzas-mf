/**
 * Amortización FRANCESA (cuota fija) para previsualizar un refinanciamiento mientras se escribe. El cálculo oficial (centavos
 * mes a mes, fechas de pago, responsables) lo hace el backend; esto solo da la respuesta inmediata del campo «cuota» y las
 * conversiones de tasa. Mismas fórmulas que `amortizacion-francesa.util.ts` del backend:
 *
 *     C = P · i · (1 + i)ⁿ / ((1 + i)ⁿ − 1)        (i = tasa mensual; con i = 0, C = P / n)
 */

const TASA_MAXIMA = 20;

/** Redondea a centavos (como el backend) evitando el error binario de `1.005`. */
export function aCentavos2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Cuota fija de un préstamo de `principal` a `numeroCuotas` con tasa mensual `tasaMensualPct` (2.15 = 2.15 %). `null` si los datos no sirven. */
export function cuotaFrancesa(principal: number, tasaMensualPct: number, numeroCuotas: number): number | null {
  if (!Number.isFinite(principal) || principal <= 0) return null;
  if (!Number.isFinite(tasaMensualPct) || tasaMensualPct < 0 || tasaMensualPct > TASA_MAXIMA) return null;
  if (!Number.isInteger(numeroCuotas) || numeroCuotas < 1) return null;
  const i = tasaMensualPct / 100;
  if (i === 0) return aCentavos2(principal / numeroCuotas);
  const factor = Math.pow(1 + i, numeroCuotas);
  return aCentavos2((principal * i * factor) / (factor - 1));
}

/** Tasa efectiva anual (%) equivalente a una mensual (%): (1 + m)¹² − 1. */
export function tasaEfectivaAnual(tasaMensualPct: number): number {
  return (Math.pow(1 + tasaMensualPct / 100, 12) - 1) * 100;
}

/** Tasa mensual (%) equivalente a una efectiva anual (%): (1 + ea)^(1/12) − 1. */
export function tasaMensualDesdeEfectivaAnual(eaPct: number): number {
  return (Math.pow(1 + eaPct / 100, 1 / 12) - 1) * 100;
}

/**
 * Tasa mensual (%) que hace que una cuota fija pague `principal` en `numeroCuotas` (la «tasa real» de lo que dice el banco, con
 * seguros y cargos incluidos). `null` si la cuota no alcanza a devolver el capital o exigiría más de 20 % mensual.
 */
export function tasaImplicitaDeCuota(principal: number, numeroCuotas: number, cuota: number): number | null {
  if (![principal, cuota].every((n) => Number.isFinite(n) && n > 0) || !Number.isInteger(numeroCuotas) || numeroCuotas < 1) return null;
  if (cuota * numeroCuotas < principal) return null;
  const valor = (tasa: number) => (tasa === 0 ? principal / numeroCuotas : (principal * (tasa / 100) * Math.pow(1 + tasa / 100, numeroCuotas)) / (Math.pow(1 + tasa / 100, numeroCuotas) - 1));
  if (valor(TASA_MAXIMA) < cuota) return null;
  if (valor(0) >= cuota) return 0;
  let bajo = 0;
  let alto = TASA_MAXIMA;
  for (let k = 0; k < 60; k += 1) {
    const medio = (bajo + alto) / 2;
    if (valor(medio) < cuota) bajo = medio;
    else alto = medio;
  }
  return (bajo + alto) / 2;
}

/** Tasa mensual (%) a partir de lo que escribió la persona: mensual tal cual o efectiva anual convertida. `null` si no es válida. */
export function tasaMensualDeEntrada(tipo: 'mensual' | 'anual', valorPct: number | null | undefined): number | null {
  if (valorPct === null || valorPct === undefined || !Number.isFinite(valorPct) || valorPct < 0) return null;
  const mensual = tipo === 'anual' ? tasaMensualDesdeEfectivaAnual(valorPct) : valorPct;
  return mensual <= TASA_MAXIMA ? mensual : null;
}
