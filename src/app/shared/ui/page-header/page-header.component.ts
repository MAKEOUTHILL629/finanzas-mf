import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Cabecera de página: título, frase de contexto y las acciones principales a la derecha (contenido proyectado).
 *   <app-page-header titulo="Personas" subtitulo="Lo que cada persona debe…"> <a appButton="secondary">Cobros</a> </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  template: `
    <header class="erp-header">
      <div class="page-header__texto">
        <h1 [id]="idTitulo">{{ titulo }}</h1>
        <p class="erp-subtitle" *ngIf="subtitulo">{{ subtitulo }}</p>
      </div>
      <div class="erp-actions"><ng-content></ng-content></div>
    </header>
  `,
  styles: [':host { display: block; } .page-header__texto { min-width: 0; }'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageHeaderComponent {
  @Input({ required: true }) titulo!: string;
  @Input() subtitulo: string | null = null;
  /** `id` del `<h1>` para enlazarlo con `aria-labelledby` de la sección. */
  @Input() idTitulo: string | null = null;
}
