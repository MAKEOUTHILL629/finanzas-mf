import { formatDate } from '@angular/common';

/**
 * El backend serializa las fechas "de calendario" (fecha de compra, de pago, de cobro…) como epoch-ms a las
 * 00:00 UTC del día. Formatearlas con la zona horaria del navegador (UTC-5 en Colombia) mostraría el día anterior y,
 * peor, al guardar se reenviaría esa fecha corrida. Los `number` se formatean, por tanto, en UTC.
 * Los `Date` (p. ej. "hoy") y los strings `yyyy-MM-dd` ya están en hora local y se formatean como siempre.
 */
export function formatDateOnly(value: number | string | Date, format = 'yyyy-MM-dd'): string {
  return typeof value === 'number'
    ? formatDate(value, format, 'en-US', 'UTC')
    : formatDate(value, format, 'en-US');
}

/** Día / mes (0-11) / año de un valor de calendario del backend, con la misma regla que `formatDateOnly`. */
export function partesFechaCalendario(value: number | string | Date): { dia: number; mes: number; anio: number } {
  const fecha = new Date(value);
  return typeof value === 'number' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
    ? { dia: fecha.getUTCDate(), mes: fecha.getUTCMonth(), anio: fecha.getUTCFullYear() }
    : { dia: fecha.getDate(), mes: fecha.getMonth(), anio: fecha.getFullYear() };
}
