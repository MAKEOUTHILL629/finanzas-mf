import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { SharedModule } from '../shared/shared.module';
import { PagoPersonaMesComponent } from './pago-persona-mes/pago-persona-mes.component';
import { PagoPersonaMesDetalleComponent } from './pago-persona-mes-detalle/pago-persona-mes-detalle.component';

/** Rutas de `RUTAS_PAGOS_PERSONAS` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_PAGOS_PERSONAS: Routes = [
  { path: '', component: PagoPersonaMesComponent, canActivate: [authGuard] },
];

/** Rutas de `RUTAS_PAGOS_PERSONAS_DETALLE` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_PAGOS_PERSONAS_DETALLE: Routes = [
  { path: ':id', component: PagoPersonaMesDetalleComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [PagoPersonaMesComponent, PagoPersonaMesDetalleComponent],
  imports: [SharedModule]
})
export class PagosMensualesModule {}
