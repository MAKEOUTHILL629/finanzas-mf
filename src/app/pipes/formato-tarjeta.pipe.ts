import { Pipe, PipeTransform } from '@angular/core';
import { SharedListasService } from '../services/shared-listas.service';

@Pipe({
  name: 'formatoTarjeta',
  pure: true
})
export class FormatoTarjetaPipe implements PipeTransform {

  constructor(private sharedListas: SharedListasService) {}

  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    return this.sharedListas.getNombreTarjetaById(value);
  }
}
