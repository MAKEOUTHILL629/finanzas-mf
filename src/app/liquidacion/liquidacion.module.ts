import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { DatosUiModule } from '../shared/datos-ui.module';
import { LiquidacionMensualComponent } from './liquidacion-mensual.component';
import { CompartirCobroModule } from '../cobros/compartir-cobro.module';
import { AbonoModule } from '../deudas/abono.module';
import { CruceModule } from '../deudas/cruce.module';
import { ExcedenteModule } from '../aportes-carro/excedente.module';

/** Rutas de `RUTAS_LIQUIDACION` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_LIQUIDACION: Routes = [
  { path: '', component: LiquidacionMensualComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [LiquidacionMensualComponent],
  imports: [DatosUiModule, CompartirCobroModule, AbonoModule, CruceModule, ExcedenteModule]
})
export class LiquidacionModule {}
