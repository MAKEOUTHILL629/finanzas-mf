import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuStateService } from '../../../services/menu-state.service';

/**
 * Estructura de toda la aplicación: navegación (barra lateral, riel, panel o barra inferior según el ancho),
 * contenedor central de ancho armónico (máx. 1280 px) y avisos. Las páginas solo aportan su contenido:
 *   <app-layout><router-outlet></router-outlet></app-layout>
 * El modo (`layout-sidebar` · `layout-rail` · `layout-drawer` · `layout-movil` · `layout-invitado`) lo decide MenuStateService.
 */
@Component({
  selector: 'app-layout',
  template: `
    <div class="app-container" [ngClass]="'layout-' + (menuEstado.layout$ | async)">
      <a class="skip-link" href="#contenido-principal" (click)="saltar($event)">Saltar al contenido</a>
      <app-menu></app-menu>
      <main class="main-content" id="contenido-principal" tabindex="-1">
        <div class="app-content"><ng-content></ng-content></div>
      </main>
      <app-toast></app-toast>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Default
})
export class AppLayoutComponent {
  constructor(readonly menuEstado: MenuStateService) {}

  /** El ancla `#…` chocaría con `<base href="/">` del enrutador: se enfoca el contenido a mano. */
  saltar(evento: Event): void {
    evento.preventDefault();
    document.getElementById('contenido-principal')?.focus();
  }
}
