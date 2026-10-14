import { Pipe, PipeTransform } from '@angular/core';
import { partesFechaCalendario } from '../shared/date-only.helper';

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Día de calendario compacto para tablas: `15 oct 2026`. Igual que `formatoFecha`, lee epoch-ms y las fechas ISO
 * `…T00:00:00.000Z` del backend en UTC para no mostrar el día anterior en Colombia (UTC-5).
 */
@Pipe({ name: 'fechaCorta', pure: true })
export class FormatoFechaCortaPipe implements PipeTransform {
  transform(value: number | string | Date | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    if (isNaN(new Date(value).getTime())) return '—';
    const { dia, mes, anio } = partesFechaCalendario(value);
    return `${dia} ${MESES_CORTOS[mes]} ${anio}`;
  }
}
