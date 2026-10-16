import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { SharedModule } from '../shared/shared.module';
import { TablaPrestamosComponent } from './tabla-prestamos/tabla-prestamos.component';
import { FormularioPrestamosComponent } from './formulario-prestamos/formulario-prestamos.component';
import { DetallePrestamoComponent } from './detalle-prestamo/detalle-prestamo.component';
import { FormularioEditarPrestamoComponent } from './formulario-editar-prestamo/formulario-editar-prestamo.component';
import { ListaCortesComponent } from './lista-cortes/lista-cortes.component';
import { FormularioCorteComponent } from './formulario-corte/formulario-corte.component';

/** Rutas de `RUTAS_PRESTAMOS` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_PRESTAMOS: Routes = [
  { path: '', component: TablaPrestamosComponent, canActivate: [authGuard] },
  { path: ':id', component: DetallePrestamoComponent, canActivate: [authGuard] },
];

/** Rutas de `RUTAS_CORTES` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_CORTES: Routes = [
  { path: '', component: ListaCortesComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [TablaPrestamosComponent, FormularioPrestamosComponent, DetallePrestamoComponent, FormularioEditarPrestamoComponent, ListaCortesComponent, FormularioCorteComponent],
  imports: [SharedModule]
})
export class PrestamosModule {}
