import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { SharedModule } from '../shared/shared.module';
import { ListaTransaccionesComponent } from './lista-transacciones/lista-transacciones.component';
import { FormularioTransaccionComponent } from './formulario-transaccion/formulario-transaccion.component';

/** Rutas de `RUTAS_TRANSACCIONES` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_TRANSACCIONES: Routes = [
  { path: '', component: ListaTransaccionesComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [ListaTransaccionesComponent, FormularioTransaccionComponent],
  imports: [SharedModule]
})
export class TransaccionesModule {}
