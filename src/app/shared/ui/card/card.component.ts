import { ChangeDetectionStrategy, Component, HostBinding, Input, booleanAttribute } from '@angular/core';

export type VarianteCard = 'glass' | 'solid' | 'flat';
export type EspaciadoCard = 'none' | 'sm' | 'md' | 'lg';

/**
 * Tarjeta del sistema de diseño: superficie de vidrio con radio suave y sombra de varias capas.
 * `<app-card titulo="Resumen" padding="lg" interactive>…</app-card>`
 */
@Component({
  selector: 'app-card',
  template: `
    <h2 class="erp-card-title" *ngIf="titulo">{{ titulo }}</h2>
    <ng-content></ng-content>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CardComponent {
  /** `glass` (translúcida, por defecto) · `solid` (opaca) · `flat` (sin sombra). */
  @Input() variant: VarianteCard = 'glass';
  /** Relleno interior; `md` es el predeterminado. */
  @Input() padding: EspaciadoCard = 'md';
  /** La tarjeta responde al puntero (se eleva al pasar el cursor): úsala en elementos clicables. */
  @Input({ transform: booleanAttribute }) interactive = false;
  /** Título opcional; si se omite, el contenido decide su propia cabecera. */
  @Input() titulo: string | null = null;

  @HostBinding('class')
  get clases(): string {
    const c = ['erp-card'];
    if (this.variant !== 'glass') c.push(`erp-card--${this.variant}`);
    if (this.padding !== 'md') c.push(`erp-card--pad-${this.padding}`);
    if (this.interactive) c.push('erp-card--clickable');
    return c.join(' ');
  }
}
