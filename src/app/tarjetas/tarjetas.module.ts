import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { DatosUiModule } from '../shared/datos-ui.module';
import { ListaTarjetasComponent } from './lista-tarjetas/lista-tarjetas.component';
import { FormularioTarjetaComponent } from './formulario-tarjeta/formulario-tarjeta.component';
import { FormularioPlasticoComponent } from './formulario-plastico/formulario-plastico.component';
import { HistorialTarjetaComponent } from './historial-tarjeta/historial-tarjeta.component';

/** Rutas de `RUTAS_TARJETAS` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_TARJETAS: Routes = [
  { path: '', component: ListaTarjetasComponent, canActivate: [authGuard] },
  { path: ':id', component: HistorialTarjetaComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [ListaTarjetasComponent, FormularioTarjetaComponent, FormularioPlasticoComponent, HistorialTarjetaComponent],
  imports: [DatosUiModule]
})
export class TarjetasModule {}
