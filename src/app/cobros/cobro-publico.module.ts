import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { CobroPublicoComponent } from './cobro-publico/cobro-publico.component';

/** Rutas de `RUTAS_COBRO_PUBLICO` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_COBRO_PUBLICO: Routes = [
  { path: ':token', component: CobroPublicoComponent },
];

@NgModule({
  declarations: [CobroPublicoComponent],
  imports: [SharedModule]
})
export class CobroPublicoModule {}
