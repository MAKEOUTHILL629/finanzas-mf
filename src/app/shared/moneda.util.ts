import { FormatoMonedaPipe } from '../pipes/formato-moneda.pipe';

const pipe = new FormatoMonedaPipe();

/** Mismo formato que el pipe `moneda`, para usarlo en código (mensajes, toasts…). */
export function moneda(valor: number | string | null | undefined, modo: 'completo' | 'compacto' = 'completo'): string {
  return pipe.transform(valor, modo);
}

// ───────── Dinero en los campos de captura ─────────
//
// Se escribe como en COP: punto para los miles (lo pone el campo solo) y coma para los decimales (`1.234.567,50`), igual que el
// campo «Valor» de la compra a crédito. Un punto tecleado se ignora a propósito: quien escribe `1.500` quiere mil quinientos, y tomarlo
// como decimal volvería la cifra mil veces menor sin que se note.

const MAX_ENTEROS = 15;
const DECIMALES_POR_DEFECTO = 2;

/** ¿Este carácter cuenta como parte de la cifra (dígito o coma decimal)? Lo demás son adornos: miles, símbolo, espacios. */
export function esCifraDeMoneda(c: string, decimales = DECIMALES_POR_DEFECTO): boolean {
  return (c >= '0' && c <= '9') || (c === ',' && decimales > 0);
}

/**
 * Da formato de dinero a lo que se escribe en un campo (`1234567,5` → `1.234.567,5`): solo dígitos y una coma decimal (con `decimales`
 * cifras como máximo), miles con punto. Lo demás que se teclee se ignora. Es idempotente: formatear lo ya formateado no lo cambia.
 */
export function formatearEntradaMoneda(texto: string, decimales = DECIMALES_POR_DEFECTO): string {
  const t = texto ?? '';
  const coma = t.indexOf(',');
  const entera = (coma === -1 ? t : t.slice(0, coma)).replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_ENTEROS);
  const conMiles = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (coma === -1 || decimales <= 0) return conMiles;
  return `${conMiles || '0'},${t.slice(coma + 1).replace(/\D/g, '').slice(0, decimales)}`;
}

/** Valor numérico de un texto con formato de dinero (`1.234.567,5` → `1234567.5`); `null` si está vacío o no es un número. */
export function leerMoneda(texto: string | number | null | undefined): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  const limpio = (texto ?? '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  if (limpio === '' || limpio === '.') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Texto de un campo para un valor que viene del programa (un número, o el texto `1500000.50` que manda el servidor). */
export function textoDeMoneda(valor: number | string | null | undefined, decimales = DECIMALES_POR_DEFECTO): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return '';
  const plano = String(n).includes('e') ? n.toFixed(Math.max(decimales, 0)) : String(n);
  return formatearEntradaMoneda(plano.replace('.', ','), decimales);
}

/**
 * Interpreta un importe pegado desde un banco, una hoja de cálculo o un chat y lo devuelve como se escribe en el campo (`1234567,5`).
 * Acepta ambos estilos: `1.500.000,50` (COP) y `1,500,000.50` (EE. UU.). Con un solo separador, un grupo de exactamente tres cifras
 * detrás (`1.500`, `1,500`) son miles —un importe no lleva tres decimales—; en otro caso (`12,5`, `1500.50`) es el decimal.
 */
export function normalizarMonedaPegada(texto: string): string {
  const t = (texto ?? '').replace(/[^\d.,]/g, '');
  const comas = t.split(',').length - 1;
  const puntos = t.split('.').length - 1;
  let decimal: ',' | '.' | null = null;
  if (comas > 0 && puntos > 0) {
    decimal = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
  } else if (comas + puntos === 1) {
    const sep = comas === 1 ? ',' : '.';
    const [entera, fraccion] = t.split(sep);
    const esGrupoDeMiles = fraccion.length === 3 && entera.length >= 1 && entera.length <= 3 && Number(entera) > 0;
    decimal = esGrupoDeMiles ? null : sep;
  }
  if (decimal === null) return t.replace(/[.,]/g, '');
  const i = t.lastIndexOf(decimal);
  return `${t.slice(0, i).replace(/[.,]/g, '')},${t.slice(i + 1).replace(/[.,]/g, '')}`;
}

export interface EntradaMoneda {
  texto: string;
  cursor: number;
}

/**
 * Da formato a lo escrito en un campo de dinero y recoloca el cursor para que no salte al final: se cuentan las cifras que había a su
 * izquierda y se deja detrás de las mismas cifras en el texto ya formateado (los miles que se agregan o quitan no lo desplazan).
 * `prefijo` (p. ej. `$ `) se antepone si hay cifra; el cursor nunca queda dentro de él.
 */
export function formatearMonedaConCursor(crudo: string, cursor: number, decimales = DECIMALES_POR_DEFECTO, prefijo = ''): EntradaMoneda {
  const cuerpo = formatearEntradaMoneda(crudo, decimales);
  if (cuerpo === '') return { texto: '', cursor: 0 };
  const texto = prefijo + cuerpo;
  let pendientes = [...crudo.slice(0, Math.max(cursor, 0))].filter((c) => esCifraDeMoneda(c, decimales)).length;
  if (pendientes === 0) return { texto, cursor: prefijo.length };
  for (let i = prefijo.length; i < texto.length; i++) {
    if (esCifraDeMoneda(texto[i], decimales) && --pendientes === 0) return { texto, cursor: i + 1 };
  }
  return { texto, cursor: texto.length };
}
