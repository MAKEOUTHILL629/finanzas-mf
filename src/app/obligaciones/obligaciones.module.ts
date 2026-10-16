import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { DatosUiModule } from '../shared/datos-ui.module';
import { ListaObligacionesComponent } from './lista-obligaciones/lista-obligaciones.component';
import { FormularioObligacionComponent } from './formulario-obligacion/formulario-obligacion.component';
import { DetalleObligacionComponent } from './detalle-obligacion/detalle-obligacion.component';
import { FormularioAportesComponent } from './formulario-aportes/formulario-aportes.component';

/** Rutas de `RUTAS_OBLIGACIONES` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_OBLIGACIONES: Routes = [
  { path: '', component: ListaObligacionesComponent, canActivate: [authGuard] },
  { path: ':id', component: DetalleObligacionComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [ListaObligacionesComponent, FormularioObligacionComponent, DetalleObligacionComponent, FormularioAportesComponent],
  imports: [DatosUiModule]
})
export class ObligacionesModule {}
