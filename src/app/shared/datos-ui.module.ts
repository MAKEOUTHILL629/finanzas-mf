import { NgModule } from '@angular/core';
import { AccionesComponent } from './ui/acciones/acciones.component';
import { AppleTableComponent } from './ui/apple-table/apple-table.component';
import { AccionesFilaDirective, CeldaTablaDirective, TarjetaFilaDirective } from './ui/apple-table/apple-table.types';
import { FilterBarComponent } from './ui/filter-bar/filter-bar.component';
import { SharedModule } from './shared.module';

const DATOS = [AccionesComponent, AccionesFilaDirective, AppleTableComponent, CeldaTablaDirective, FilterBarComponent, TarjetaFilaDirective];

/**
 * Componentes para pantallas de listas: tabla Apple (paginación, orden, columnas, tarjetas en móvil), barra de filtros y acciones
 * de cabecera (con botón flotante en móvil). Aparte de `SharedModule` para que el paquete inicial (menú, login) no los lleve:
 * cada módulo de funcionalidad que muestra listas lo importa.
 */
@NgModule({
  declarations: DATOS,
  imports: [SharedModule],
  exports: [...DATOS, SharedModule],
})
export class DatosUiModule {}
