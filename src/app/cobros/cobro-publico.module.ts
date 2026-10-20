import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { CobroPublicoComponent } from './cobro-publico/cobro-publico.component';
import { MetodosPagoPublicoModule } from './metodos-pago-publico.module';
import { PortalAcreedorComponent } from './portal-acreedor/portal-acreedor.component';

/** Rutas de `RUTAS_COBRO_PUBLICO` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_COBRO_PUBLICO: Routes = [
  { path: 'prestamo/:token', component: PortalAcreedorComponent },
  { path: ':token', component: CobroPublicoComponent },
];

@NgModule({
  declarations: [CobroPublicoComponent, PortalAcreedorComponent],
  imports: [SharedModule, MetodosPagoPublicoModule]
})
export class CobroPublicoModule {}
