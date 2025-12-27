import { Pipe, PipeTransform } from '@angular/core';
import { months } from '../modelos/compras-credito';

@Pipe({
  name: 'formatoFecha'
})
export class FormatoFechaPipe implements PipeTransform {

  transform(value: number | string | Date | undefined): string {
    if (!value || value== undefined) return '';

    const date = new Date(value);


    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} de ${month} del ${year}`;
  }
}
