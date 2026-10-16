import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';

/**
 * Esqueleto de carga: un bloque que ocupa el lugar del contenido que viene, con su misma geometría, para que al llegar los datos
 * nada se mueva (Cumulative Layout Shift ≈ 0). Reemplaza a los spinners que bloquean la pantalla.
 *
 *   <app-skeleton ancho="60%" alto="2.5rem"></app-skeleton>        un bloque
 *   <app-skeleton variante="linea" ancho="8rem"></app-skeleton>    una línea de texto
 *   <app-skeleton variante="circulo" ancho="40px" alto="40px">     un avatar
 */
@Component({
  selector: 'app-skeleton',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SkeletonComponent {
  @Input() variante: 'bloque' | 'linea' | 'circulo' = 'bloque';
  @Input() ancho: string | null = null;
  @Input() alto: string | null = null;

  @HostBinding('class') get clases(): string {
    return this.variante === 'bloque' ? 'erp-skeleton' : `erp-skeleton erp-skeleton--${this.variante}`;
  }
  @HostBinding('attr.aria-hidden') readonly oculto = 'true';
  @HostBinding('style.width') get w(): string | null {
    return this.ancho;
  }
  @HostBinding('style.height') get h(): string | null {
    return this.alto;
  }
}
