import { Pipe, PipeTransform } from '@angular/core';
import { SharedListasService } from '../services/shared-listas.service';

@Pipe({
  name: 'formatoTarjeta'
})
export class FormatoTarjetaPipe implements PipeTransform {

  constructor(private sharedListas: SharedListasService) {
  }

  transform(
    value: number,

  ): string {
    // Obtenemos la lista directamente desde el servicio
    const lista = this.sharedListas.listaTarjetas;

    if (!lista || !Array.isArray(lista)) {
      return '';
    }

    // Buscamos el objeto donde la propiedad ID coincida
    const objetoEncontrado = lista.find(item => item.id === value);

    // Retornamos la propiedad deseada si existe, o cadena vacía si no se encontró
    return objetoEncontrado ? objetoEncontrado.franquicia || '' : '';
  }

}
