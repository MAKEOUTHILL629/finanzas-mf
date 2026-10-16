import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { SharedModule } from '../shared/shared.module';
import { EstadoCuentaComponent } from './estado-cuenta/estado-cuenta.component';
import { ListaCrucesComponent } from './lista-cruces/lista-cruces.component';
import { AbonoModule } from './abono.module';
import { CruceModule } from './cruce.module';

/** Rutas de `RUTAS_ESTADO_CUENTA` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_ESTADO_CUENTA: Routes = [
  { path: '', component: EstadoCuentaComponent, canActivate: [authGuard] },
];

/** Rutas de `RUTAS_CRUCES` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_CRUCES: Routes = [
  { path: '', component: ListaCrucesComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [EstadoCuentaComponent, ListaCrucesComponent],
  imports: [SharedModule, AbonoModule, CruceModule]
})
export class DeudasModule {}
