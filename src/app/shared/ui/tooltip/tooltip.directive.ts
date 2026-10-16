import { Directive, ElementRef, HostListener, Input, OnDestroy, numberAttribute } from '@angular/core';
import { PosicionTooltip, TooltipService } from './tooltip.service';

/**
 * Ayuda contextual de un botón o control: al pasar el cursor o enfocarlo con el teclado (escritorio) y al mantenerlo presionado
 * (móvil) aparece una frase que dice qué hace. Si no se da texto, un botón de solo ícono usa su `aria-label`.
 *
 *   <button appButton="ghost" icon appTooltip="Editar la cuenta" aria-label="Editar la cuenta">…</button>
 *
 * Es independiente (standalone) para poder usarla también como directiva anfitriona de `appButton`.
 */
@Directive({
  standalone: true
})
export class TooltipBaseDirective implements OnDestroy {
  @Input('appTooltip') texto: string | null | undefined;
  @Input() tooltipPosicion: PosicionTooltip = 'arriba';
  /** Espera antes de mostrarlo con el cursor (ms): evita que parpadee al cruzar la pantalla. */
  @Input({ transform: numberAttribute }) tooltipRetardo = 350;

  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private mantenido: ReturnType<typeof setTimeout> | null = null;
  private ocultarTactil: ReturnType<typeof setTimeout> | null = null;
  private suprimirClicHasta = 0;

  constructor(
    private host: ElementRef<HTMLElement>,
    private servicio: TooltipService
  ) {
    // el globo reemplaza al `title` nativo (no se muestran los dos)
    const el = host.nativeElement;
    const titulo = el.getAttribute('title');
    if (titulo) {
      el.dataset['tooltipTitulo'] = titulo;
      el.removeAttribute('title');
    }
    el.addEventListener('click', this.alHacerClic, true);
  }

  /** Lo que se dice: el texto dado o, en botones de solo ícono, el aria-label / title. */
  private get frase(): string {
    const el = this.host.nativeElement;
    if (this.texto) return this.texto;
    if (el.classList.contains('erp-btn--icon')) return el.getAttribute('aria-label') ?? el.dataset['tooltipTitulo'] ?? '';
    return '';
  }

  @HostListener('mouseenter') alEntrar(): void {
    if (typeof matchMedia === 'function' && matchMedia('(hover: none)').matches) return; // en táctil, solo mantener presionado
    this.programar(this.tooltipRetardo);
  }

  @HostListener('mouseleave') alSalir(): void {
    this.ocultar();
  }

  @HostListener('focusin', ['$event']) alEnfocar(evento: FocusEvent): void {
    // solo con el teclado (un clic con el ratón enfoca y taparía el globo justo al pulsar)
    const el = evento.target as HTMLElement | null;
    if (el && typeof el.matches === 'function' && !el.matches(':focus-visible')) return;
    this.programar(0);
  }

  @HostListener('focusout') alDesenfocar(): void {
    this.ocultar();
  }

  @HostListener('document:keydown.escape') alEscape(): void {
    this.ocultar();
  }

  @HostListener('touchstart') alTocar(): void {
    this.limpiar();
    this.mantenido = setTimeout(() => {
      this.mantenido = null;
      if (this.mostrar()) this.suprimirClicHasta = Date.now() + 1500;
    }, 450);
  }

  @HostListener('touchend')
  @HostListener('touchcancel')
  @HostListener('touchmove')
  alSoltar(): void {
    if (this.mantenido) {
      clearTimeout(this.mantenido);
      this.mantenido = null;
    }
    if (this.suprimirClicHasta > Date.now()) {
      this.ocultarTactil = setTimeout(() => this.ocultar(), 1800);
    }
  }

  /** Si el globo salió por mantener presionado, el «clic» que genera soltar el dedo no debe ejecutar la acción del botón. */
  private alHacerClic = (evento: Event): void => {
    if (this.suprimirClicHasta > Date.now()) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      this.suprimirClicHasta = 0;
    }
  };

  private programar(retardo: number): void {
    this.limpiar();
    if (!this.frase) return;
    if (retardo <= 0) {
      this.mostrar();
      return;
    }
    this.temporizador = setTimeout(() => this.mostrar(), retardo);
  }

  private mostrar(): boolean {
    const f = this.frase;
    if (!f) return false;
    this.servicio.mostrar(this.host.nativeElement, f, this.tooltipPosicion);
    return true;
  }

  private ocultar(): void {
    this.limpiar();
    this.servicio.ocultar(this.host.nativeElement);
  }

  private limpiar(): void {
    for (const t of [this.temporizador, this.mantenido, this.ocultarTactil]) if (t) clearTimeout(t);
    this.temporizador = this.mantenido = this.ocultarTactil = null;
  }

  ngOnDestroy(): void {
    this.host.nativeElement.removeEventListener('click', this.alHacerClic, true);
    this.ocultar();
  }
}

/**
 * `appTooltip` sobre cualquier elemento. En los botones `appButton` el globo viene incluido (directiva anfitriona del botón),
 * por eso aquí se excluyen: una directiva no puede aplicarse dos veces al mismo elemento.
 */
@Directive({
  selector: '[appTooltip]:not([appButton])',
  standalone: true
})
export class TooltipDirective extends TooltipBaseDirective {}
