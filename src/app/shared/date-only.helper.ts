import { formatDate } from '@angular/common';

/**
 * Las fechas "de calendario" (fecha de compra, de pago, de cobro, de aporte…) llegan del backend en tres formas:
 *  - epoch-ms a las 00:00 UTC (endpoints legacy);
 *  - ISO `yyyy-MM-ddT00:00:00.000Z` (endpoints ERP, columnas `date` de Postgres);
 *  - `yyyy-MM-dd` (lo que producen los `<input type="date">`).
 * Formatear las dos primeras con la zona del navegador (UTC-5 en Colombia) mostraría el día anterior y, peor, al
 * guardar se reenviaría esa fecha corrida. Por eso se leen en UTC. Un `yyyy-MM-dd` y un `Date` local ya están en hora
 * local y se formatean como siempre.
 */
const ISO_MEDIANOCHE_UTC = /^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?Z$/;
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** ¿Hay que leerlo en UTC? (epoch-ms o ISO a medianoche UTC) */
function esInstanteDeCalendarioUtc(value: number | string | Date): boolean {
  return typeof value === 'number' || (typeof value === 'string' && ISO_MEDIANOCHE_UTC.test(value));
}

export function formatDateOnly(value: number | string | Date, format = 'yyyy-MM-dd'): string {
  return esInstanteDeCalendarioUtc(value) ? formatDate(value, format, 'en-US', 'UTC') : formatDate(value, format, 'en-US');
}

/** Día / mes (0-11) / año de un valor de calendario del backend, con la misma regla que `formatDateOnly`. */
export function partesFechaCalendario(value: number | string | Date): { dia: number; mes: number; anio: number } {
  const fecha = new Date(value);
  // `new Date('yyyy-MM-dd')` ya se interpreta como 00:00 UTC, igual que los otros dos formatos de calendario.
  const enUtc = esInstanteDeCalendarioUtc(value) || (typeof value === 'string' && SOLO_FECHA.test(value));
  return enUtc
    ? { dia: fecha.getUTCDate(), mes: fecha.getUTCMonth(), anio: fecha.getUTCFullYear() }
    : { dia: fecha.getDate(), mes: fecha.getMonth(), anio: fecha.getFullYear() };
}
