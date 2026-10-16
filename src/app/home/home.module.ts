import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { SharedModule } from '../shared/shared.module';
import { HomeComponent } from './home.component';

/** Rutas de `RUTAS_HOME` (se cargan de forma diferida desde `app-routing.module.ts`). */
export const RUTAS_HOME: Routes = [
  { path: '', component: HomeComponent, canActivate: [authGuard] },
];

@NgModule({
  declarations: [HomeComponent],
  imports: [SharedModule]
})
export class HomeModule {}
