import { ChangeDetectionStrategy, Component, ElementRef, HostBinding, Input, OnDestroy, booleanAttribute } from '@angular/core';

export type VarianteBoton = 'primary' | 'secondary' | 'ghost' | 'danger';
export type TamanoBoton = 'sm' | 'md' | 'lg';

/**
 * Botón del sistema de diseño (relleno, tintado, discreto o de peligro) con objetivo táctil de 44 px.
 * Se aplica sobre un `<button>` o un `<a>` nativo, así conserva su semántica y su teclado:
 * `<button appButton="primary" size="sm" [loading]="enviando">Guardar</button>`
 */
@Component({
  selector: 'button[appButton], a[appButton]',
  template: '<ng-content></ng-content>',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ButtonComponent implements OnDestroy {
  @Input('appButton') variant: VarianteBoton | '' = 'primary';
  @Input() size: TamanoBoton = 'md';
  /** Botón cuadrado de solo ícono (recuerda poner `aria-label`). */
  @Input({ transform: booleanAttribute }) icon = false;
  /** Ocupa todo el ancho disponible. */
  @Input({ transform: booleanAttribute }) block = false;
  /** Muestra un indicador y evita pulsaciones repetidas sin cambiar el ancho del botón. */
  @Input({ transform: booleanAttribute }) loading = false;

  @HostBinding('class')
  get clases(): string {
    const c = ['erp-btn', `erp-btn--${this.variant || 'primary'}`];
    if (this.size !== 'md') c.push(`erp-btn--${this.size}`);
    if (this.icon) c.push('erp-btn--icon');
    if (this.block) c.push('erp-btn--block');
    if (this.loading) c.push('erp-btn--loading');
    return c.join(' ');
  }

  @HostBinding('attr.aria-busy') get ocupado(): 'true' | null {
    return this.loading ? 'true' : null;
  }

  /**
   * Mientras carga se ignoran los clics (también los del teclado, que llegan como `click`). Se escucha en la fase de captura
   * para actuar antes que el `(click)` de la plantilla, que está en el mismo elemento.
   */
  private readonly bloquearClics = (evento: Event): void => {
    if (this.loading) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
    }
  };

  constructor(private el: ElementRef<HTMLElement>) {
    el.nativeElement.addEventListener('click', this.bloquearClics, true);
  }

  ngOnDestroy(): void {
    this.el.nativeElement.removeEventListener('click', this.bloquearClics, true);
  }
}
