import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { DatosUiModule } from '../shared/datos-ui.module';
import { ListaCuentasComponent } from './lista-cuentas/lista-cuentas.component';
import { FormularioCuentaComponent } from './formulario-cuenta/formulario-cuenta.component';
import { ListaCategoriasComponent } from './lista-categorias/lista-categorias.component';
import { FormularioCategoriaComponent } from './formulario-categoria/formulario-categoria.component';

/** Rutas de `RUTAS_CUENTAS` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_CUENTAS: Routes = [
  { path: '', component: ListaCuentasComponent, canActivate: [authGuard] },
];

/** Rutas de `RUTAS_CATEGORIAS` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_CATEGORIAS: Routes = [
  { path: '', component: ListaCategoriasComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [ListaCuentasComponent, FormularioCuentaComponent, ListaCategoriasComponent, FormularioCategoriaComponent],
  imports: [DatosUiModule]
})
export class CuentasModule {}
