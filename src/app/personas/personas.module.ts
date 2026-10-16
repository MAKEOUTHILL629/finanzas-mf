import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { DatosUiModule } from '../shared/datos-ui.module';
import { ListaPersonasComponent } from './lista-personas/lista-personas.component';
import { DetallePersonaComponent } from './detalle-persona/detalle-persona.component';
import { AbonoModule } from '../deudas/abono.module';

/** Rutas de `RUTAS_PERSONAS` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_PERSONAS: Routes = [
  { path: '', component: ListaPersonasComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [ListaPersonasComponent, DetallePersonaComponent],
  imports: [DatosUiModule, AbonoModule]
})
export class PersonasModule {}
