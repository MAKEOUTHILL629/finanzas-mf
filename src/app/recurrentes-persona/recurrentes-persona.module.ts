import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { DatosUiModule } from '../shared/datos-ui.module';
import { ListaRecurrentesPersonaComponent } from './lista-recurrentes-persona/lista-recurrentes-persona.component';
import { FormularioRecurrentePersonaComponent } from './formulario-recurrente-persona/formulario-recurrente-persona.component';
import { RadarSuscripcionesComponent } from './radar-suscripciones/radar-suscripciones.component';

/** Rutas de `RUTAS_RECURRENTES` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_RECURRENTES: Routes = [
  { path: '', component: ListaRecurrentesPersonaComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [ListaRecurrentesPersonaComponent, FormularioRecurrentePersonaComponent, RadarSuscripcionesComponent],
  imports: [DatosUiModule]
})
export class RecurrentesPersonaModule {}
