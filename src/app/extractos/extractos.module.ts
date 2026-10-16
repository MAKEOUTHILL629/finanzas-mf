import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { SharedModule } from '../shared/shared.module';
import { ExtractosTarjetasComponent } from './extractos-tarjetas/extractos-tarjetas.component';
import { FormularioPagarExtractoComponent } from './formulario-pagar-extracto/formulario-pagar-extracto.component';

/** Rutas de `RUTAS_EXTRACTOS` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_EXTRACTOS: Routes = [
  { path: '', component: ExtractosTarjetasComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [ExtractosTarjetasComponent, FormularioPagarExtractoComponent],
  imports: [SharedModule]
})
export class ExtractosModule {}
