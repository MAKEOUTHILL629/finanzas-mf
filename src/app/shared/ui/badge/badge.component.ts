import { ChangeDetectionStrategy, Component, HostBinding, Input, booleanAttribute } from '@angular/core';

export type TonoBadge = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'premium';

/** Insignia de estado: `<app-badge tone="success" icon="check_circle">Pagada</app-badge>`. */
@Component({
  selector: 'app-badge',
  template: `<i class="material-icons" aria-hidden="true" *ngIf="icon">{{ icon }}</i><ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BadgeComponent {
  @Input() tone: TonoBadge = 'neutral';
  /** Nombre de un ícono de Material Icons (opcional). */
  @Input() icon: string | null = null;
  /** Relleno sólido (para contadores y alertas que deben destacar). */
  @Input({ transform: booleanAttribute }) solid = false;

  @HostBinding('class')
  get clases(): string {
    const c = ['erp-badge'];
    if (this.tone !== 'neutral') c.push(`erp-badge--${this.tone}`);
    if (this.solid) c.push('erp-badge--solid');
    return c.join(' ');
  }
}
