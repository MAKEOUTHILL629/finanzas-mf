import { Pipe, PipeTransform } from '@angular/core';
import { months } from '../modelos/compras-credito';

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

    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    if (!month) {
      return '';
    }

    return `${day} de ${month} del ${year}`;
  }
}
