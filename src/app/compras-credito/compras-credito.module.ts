import { NgModule } from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective } from 'ng2-charts';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { PROVEEDOR_GRAFICAS } from '../shared/charts';
import { DatosUiModule } from '../shared/datos-ui.module';
import { SharedModule } from '../shared/shared.module';
import { TablaComprasCreditoComponent } from './tabla-compras-credito/tabla-compras-credito.component';
import { FormularioComprasCreditoComponent } from './formulario-compras-credito/formulario-compras-credito.component';
import { FormularioCsvComprasComponent } from './formulario-csv-compras/formulario-csv-compras.component';
import { DetalleComprasCreditoComponent } from './detalle-compras-credito/detalle-compras-credito.component';
import { ResponsableCreditoComponent } from './responsable-credito/responsable-credito.component';
import { PagosMesTarjetasComponent } from './pagos-mes-tarjetas/pagos-mes-tarjetas.component';
import { PagosMesTarjetasDetalleComponent } from './pagos-mes-tarjetas-detalle/pagos-mes-tarjetas-detalle.component';
import { BalanceMesComponent } from './balance-mes/balance-mes.component';
import { UnificarDeudaComponent } from './unificar-deuda/unificar-deuda.component';

/** Rutas de `RUTAS_COMPRAS` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_COMPRAS: Routes = [
  { path: '', component: TablaComprasCreditoComponent, canActivate: [authGuard] },
];

/** Rutas de `RUTAS_COMPRA_DETALLE` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_COMPRA_DETALLE: Routes = [
  { path: ':id', component: DetalleComprasCreditoComponent, canActivate: [authGuard], providers: [PROVEEDOR_GRAFICAS] },
];

/** Rutas de `RUTAS_PAGOS_MES` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_PAGOS_MES: Routes = [
  { path: '', component: PagosMesTarjetasComponent, canActivate: [authGuard] },
  { path: ':id', component: PagosMesTarjetasDetalleComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [TablaComprasCreditoComponent, FormularioComprasCreditoComponent, FormularioCsvComprasComponent, DetalleComprasCreditoComponent, ResponsableCreditoComponent, PagosMesTarjetasComponent, PagosMesTarjetasDetalleComponent, BalanceMesComponent, UnificarDeudaComponent],
  imports: [SharedModule, DatosUiModule, MatAutocompleteModule, MatInputModule, MatProgressSpinnerModule, BaseChartDirective]
})
export class ComprasCreditoModule {}
