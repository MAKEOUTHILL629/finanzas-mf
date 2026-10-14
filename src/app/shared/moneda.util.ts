import { FormatoMonedaPipe } from '../pipes/formato-moneda.pipe';

const pipe = new FormatoMonedaPipe();

/** Mismo formato que el pipe `moneda`, para usarlo en código (mensajes, toasts…). */
export function moneda(valor: number | string | null | undefined, modo: 'completo' | 'compacto' = 'completo'): string {
  return pipe.transform(valor, modo);
}
