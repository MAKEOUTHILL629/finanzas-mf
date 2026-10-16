import { ChangeDetectionStrategy, Component, Input, numberAttribute } from '@angular/core';

/**
 * Logo oficial de Finanzas Make (`public/brand/logo.svg`). Es un ícono con su propia sombra y bisel: no se recolorea ni se recorta.
 *   <app-logo size="36"></app-logo>
 */
@Component({
  selector: 'app-logo',
  template: `<img class="logo__img" src="brand/logo.svg" [attr.width]="size" [attr.height]="size" [alt]="alt" decoding="async" draggable="false" />`,
  styles: [':host { display: inline-flex; flex: none; line-height: 0; } .logo__img { display: block; user-select: none; -webkit-user-drag: none; }'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LogoComponent {
  /** Lado en píxeles (el ícono es cuadrado). */
  @Input({ transform: numberAttribute }) size = 36;
  /** Texto alternativo; usa `''` cuando el nombre de la app ya está escrito al lado (decorativo). */
  @Input() alt = 'Finanzas Make';
}
