import { FormatoMonedaPipe } from '../pipes/formato-moneda.pipe';

const pipe = new FormatoMonedaPipe();

/** Mismo formato que el pipe `moneda`, para usarlo en código (mensajes, toasts…). */
export function moneda(valor: number | string | null | undefined, modo: 'completo' | 'compacto' = 'completo'): string {
  return pipe.transform(valor, modo);
}

/**
 * Da formato de dinero a lo que se escribe en un campo (`1234567.5` → `1,234,567.5`): solo dígitos y un punto decimal (máx. 2 decimales),
 * miles con coma como en el resto de la aplicación. Lo demás que se teclee se ignora.
 */
export function formatearEntradaMoneda(texto: string): string {
  const limpio = (texto ?? '').replace(/[^0-9.]/g, '');
  const punto = limpio.indexOf('.');
  const entera = (punto === -1 ? limpio : limpio.slice(0, punto)).replace(/^0+(?=\d)/, '');
  const decimales = punto === -1 ? null : limpio.slice(punto + 1).replace(/\./g, '').slice(0, 2);
  const conMiles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimales === null ? conMiles : `${conMiles || '0'}.${decimales}`;
}

/** Valor numérico de un texto con formato de dinero (`1,234.50` → `1234.5`); `null` si está vacío o no es un número. */
export function leerMoneda(texto: string | number | null | undefined): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  const limpio = (texto ?? '').replace(/,/g, '').trim();
  if (limpio === '' || limpio === '.') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}
