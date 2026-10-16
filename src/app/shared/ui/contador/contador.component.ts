import { ChangeDetectionStrategy, Component, ElementRef, Input, NgZone, OnChanges, OnDestroy, ViewChild, booleanAttribute, numberAttribute } from '@angular/core';
import { moneda } from '../../moneda.util';
import { MOVIMIENTO_REDUCIDO } from '../../motion';

/**
 * Cifra con conteo animado: al llegar (o cambiar) el valor, los dígitos «ruedan» suavemente hasta el nuevo importe, como en iOS.
 * Se pinta fuera de Angular (un `requestAnimationFrame` no dispara detección de cambios) y respeta «reducir movimiento».
 * Los lectores de pantalla leen siempre el valor final (el texto animado va oculto para ellos).
 *
 *   <app-contador [valor]="liquidez.total"></app-contador>              → $8,450,300.50
 *   <app-contador [valor]="saldo" modo="compacto" signo></app-contador> → +$1.2M
 */
@Component({
  selector: 'app-contador',
  template: `<span #visible class="contador__cifra" aria-hidden="true"></span><span class="erp-sr-only">{{ final }}</span>`,
  styles: [':host { display: inline; font-variant-numeric: tabular-nums; }'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContadorComponent implements OnChanges, OnDestroy {
  /** Pruebas y capturas pueden apagar la animación para ver siempre el valor final. */
  static animar = true;

  @Input({ required: true, transform: numberAttribute }) valor = 0;
  @Input() modo: 'completo' | 'compacto' = 'completo';
  /** Duración en milisegundos. */
  @Input({ transform: numberAttribute }) duracion = 900;
  /** Antepone «+» a los positivos. */
  @Input({ transform: booleanAttribute }) signo = false;

  @ViewChild('visible', { static: true }) private visible!: ElementRef<HTMLElement>;

  /** Texto final (el que leen los lectores de pantalla). */
  final = '';

  private mostrado = 0;
  private cuadro: number | null = null;
  private primera = true;

  constructor(private zona: NgZone) {}

  ngOnChanges(): void {
    const destino = Number.isFinite(this.valor) ? this.valor : 0;
    this.final = this.formatear(destino);
    this.detener();
    const desde = this.primera ? 0 : this.mostrado;
    this.primera = false;
    if (!ContadorComponent.animar || MOVIMIENTO_REDUCIDO() || desde === destino || typeof requestAnimationFrame === 'undefined') {
      this.pintar(destino);
      return;
    }
    this.zona.runOutsideAngular(() => {
      const inicio = performance.now();
      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - inicio) / Math.max(1, this.duracion));
        // easeOutExpo: arranca rápido y se asienta con suavidad
        const k = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        this.pintar(desde + (destino - desde) * k);
        this.cuadro = t < 1 ? requestAnimationFrame(paso) : null;
        if (t === 1) this.pintar(destino);
      };
      this.pintar(desde);
      this.cuadro = requestAnimationFrame(paso);
    });
  }

  ngOnDestroy(): void {
    this.detener();
  }

  private detener(): void {
    if (this.cuadro !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.cuadro);
    this.cuadro = null;
  }

  private pintar(n: number): void {
    this.mostrado = n;
    this.visible.nativeElement.textContent = this.formatear(n);
  }

  private formatear(n: number): string {
    const texto = moneda(n, this.modo);
    return this.signo && n > 0 ? `+${texto}` : texto;
  }
}
