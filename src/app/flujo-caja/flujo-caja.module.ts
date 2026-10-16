import { NgModule } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { PROVEEDOR_GRAFICAS } from '../shared/charts';
import { DatosUiModule } from '../shared/datos-ui.module';
import { FlujoCajaComponent } from './flujo-caja.component';

/** Rutas de `RUTAS_FLUJO_CAJA` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_FLUJO_CAJA: Routes = [
  { path: '', component: FlujoCajaComponent, canActivate: [authGuard], providers: [PROVEEDOR_GRAFICAS] },
];

@NgModule({
  declarations: [FlujoCajaComponent],
  imports: [DatosUiModule, BaseChartDirective]
})
export class FlujoCajaModule {}
