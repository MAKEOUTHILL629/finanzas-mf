import { Pipe, PipeTransform } from '@angular/core';
import { SharedListasService } from '../services/shared-listas.service';

@Pipe({
  name: 'formatoPersona',
  // Impuro a propósito: el nombre aparece cuando llega el catálogo, aunque el id no cambie. Es una búsqueda O(1) en un mapa.
  pure: false
})
export class FormatoPersonaPipe implements PipeTransform {

  constructor(private sharedListas: SharedListasService) {
    this.sharedListas.asegurar();
  }

  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    return this.sharedListas.getNombrePersonaById(value);
  }
}
