import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { SharedModule } from '../shared/shared.module';
import { ListaCorreosComponent } from './lista-correos/lista-correos.component';
import { FormularioConciliarComponent } from './formulario-conciliar/formulario-conciliar.component';
import { ProductosDetectadosComponent } from './productos-detectados/productos-detectados.component';
import { ReprocesarCorreosComponent } from './reprocesar-correos/reprocesar-correos.component';

/** Rutas de `RUTAS_CORREOS` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_CORREOS: Routes = [
  { path: '', component: ListaCorreosComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [ListaCorreosComponent, FormularioConciliarComponent, ProductosDetectadosComponent, ReprocesarCorreosComponent],
  imports: [SharedModule]
})
export class CorreosModule {}
