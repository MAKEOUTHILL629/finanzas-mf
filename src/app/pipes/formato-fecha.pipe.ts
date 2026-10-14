import { Pipe, PipeTransform } from '@angular/core';
import { months } from '../modelos/compras-credito';
import { partesFechaCalendario } from '../shared/date-only.helper';

@Pipe({
  name: 'formatoFecha',
  pure: true
})
export class FormatoFechaPipe implements PipeTransform {

  transform(value: number | string | Date | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return '';
    }

    // Los epoch-ms del backend son 00:00 UTC del día: se leen en UTC para no mostrar el día anterior (UTC-5).
    const { dia: day, mes, anio: year } = partesFechaCalendario(value);
    const month = months[mes];

    if (!month) {
      return '';
    }

    return `${day} de ${month} del ${year}`;
  }
}
