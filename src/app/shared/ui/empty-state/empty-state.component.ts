import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

/** Estado vacío con ícono, título, explicación y (opcional) la acción para empezar. */
@Component({
  selector: 'app-empty-state',
  template: `
    <i class="material-icons" aria-hidden="true">{{ icon }}</i>
    <h2>{{ titulo }}</h2>
    <p *ngIf="descripcion">{{ descripcion }}</p>
    <ng-content></ng-content>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  @HostBinding('class') readonly clases = 'erp-card erp-empty';
  @Input() icon = 'inbox';
  @Input({ required: true }) titulo!: string;
  @Input() descripcion: string | null = null;
}
