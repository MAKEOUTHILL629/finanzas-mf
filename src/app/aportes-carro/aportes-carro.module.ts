import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { SharedModule } from '../shared/shared.module';
import { AportesCarroComponent } from './aportes-carro.component';
import { FormularioAporteDiarioComponent } from './formulario-aporte-diario/formulario-aporte-diario.component';
import { FormularioPeriodoCarroComponent } from './formulario-periodo-carro/formulario-periodo-carro.component';
import { ExcedenteModule } from './excedente.module';

/** Rutas de `RUTAS_APORTES_CARRO` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_APORTES_CARRO: Routes = [
  { path: '', component: AportesCarroComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [AportesCarroComponent, FormularioAporteDiarioComponent, FormularioPeriodoCarroComponent],
  imports: [SharedModule, ExcedenteModule]
})
export class AportesCarroModule {}
