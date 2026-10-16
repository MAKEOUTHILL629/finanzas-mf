import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { DatosUiModule } from '../shared/datos-ui.module';
import { ListaCorreosComponent } from './lista-correos/lista-correos.component';
import { ConciliarCorreoComponent } from './conciliar-correo/conciliar-correo.component';
import { FormularioConciliarComponent } from './formulario-conciliar/formulario-conciliar.component';
import { ProductosDetectadosComponent } from './productos-detectados/productos-detectados.component';
import { ReprocesarCorreosComponent } from './reprocesar-correos/reprocesar-correos.component';
import { VisorCorreoComponent } from './visor-correo/visor-correo.component';

/** Rutas de `RUTAS_CORREOS` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_CORREOS: Routes = [
  { path: '', component: ListaCorreosComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [ListaCorreosComponent, ConciliarCorreoComponent, FormularioConciliarComponent, VisorCorreoComponent, ProductosDetectadosComponent, ReprocesarCorreosComponent],
  imports: [DatosUiModule]
})
export class CorreosModule {}
