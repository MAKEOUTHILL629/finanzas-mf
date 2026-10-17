import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { DatosUiModule } from '../shared/datos-ui.module';
import { CobrosComponent } from './cobros.component';
import { FormularioCobroComponent } from './formulario-cobro/formulario-cobro.component';
import { AprobarReporteComponent } from './aprobar-reporte/aprobar-reporte.component';
import { CompartirCobroModule } from './compartir-cobro.module';
import { DescuentoEnlaceComponent } from './descuento-enlace/descuento-enlace.component';
import { MetodosPagoComponent } from './metodos-pago/metodos-pago.component';
import { MetodosPagoPublicoModule } from './metodos-pago-publico.module';
import { ObservacionesCobroComponent } from './observaciones-cobro/observaciones-cobro.component';

/** Rutas de `RUTAS_COBROS` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_COBROS: Routes = [
  { path: '', component: CobrosComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [CobrosComponent, FormularioCobroComponent, AprobarReporteComponent, MetodosPagoComponent, ObservacionesCobroComponent, DescuentoEnlaceComponent],
  imports: [DatosUiModule, CompartirCobroModule, MetodosPagoPublicoModule]
})
export class CobrosModule {}
