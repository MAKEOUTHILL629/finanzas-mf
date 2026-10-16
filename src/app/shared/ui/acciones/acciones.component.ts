import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';

export type VarianteAccion = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface AccionUI {
  id: string;
  etiqueta: string;
  /** Ícono de Material Icons. */
  icono: string;
  /** Frase que dice qué hace (globo de ayuda); por defecto, la etiqueta. */
  tooltip?: string;
  deshabilitada?: boolean;
  /** Muestra un indicador y bloquea los clics (p. ej. «Actualizando…»). */
  cargando?: boolean;
  /** Si es un enlace de navegación en vez de una acción (se usa `routerLink`). */
  enlace?: string | unknown[];
  variante?: VarianteAccion;
}

/** Acción habitual de las pantallas con selector de mes: volver al mes en curso. */
export const ACCION_MES_ACTUAL: AccionUI = { id: 'mes-actual', etiqueta: 'Mes actual', icono: 'today', variante: 'ghost', tooltip: 'Volver al mes en curso' };

/**
 * Memoriza la lista de acciones mientras su «clave» no cambie. Las pantallas con acciones que dependen del estado (p. ej. «Mes actual» solo
 * cuando no estás en el mes actual) la usan en un getter para no crear un arreglo nuevo en cada ciclo de detección de cambios:
 *
 *   private acc = new ListaAcciones();
 *   get secundarias() { return this.acc.obtener(String(this.esMesActual()), () => [...]); }
 */
export class ListaAcciones {
  private claveActual: string | null = null;
  private lista: AccionUI[] = [];

  obtener(clave: string, construir: () => AccionUI[]): AccionUI[] {
    if (clave !== this.claveActual) {
      this.claveActual = clave;
      this.lista = construir();
    }
    return this.lista;
  }
}

/**
 * Acciones de una pantalla con UN solo patrón en toda la aplicación:
 *  · Escritorio: botones en la cabecera — las secundarias con ícono y texto, la principal destacada a la derecha.
 *  · Móvil: un único botón flotante (FAB) con la acción principal, por encima de la barra de pestañas y sin tapar el contenido,
 *    y las demás en un menú «Más acciones».
 * Todas llevan globo de ayuda. La pantalla solo declara las acciones y atiende `(accion)`:
 *
 *   <app-acciones [principal]="nueva" [secundarias]="otras" (accion)="alAccionar($event)"></app-acciones>
 */
@Component({
  selector: 'app-acciones',
  templateUrl: './acciones.component.html',
  styleUrl: './acciones.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccionesComponent {
  @Input() principal: AccionUI | null = null;
  @Input() secundarias: AccionUI[] = [];
  /** Si se pone, los botones de escritorio no repiten el texto de la secundaria (solo ícono + globo): útil con muchas acciones. */
  @Input() compacto = false;
  @Output() accion = new EventEmitter<string>();

  menuAbierto = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private el: ElementRef<HTMLElement>
  ) {}

  disparar(a: AccionUI): void {
    if (a.deshabilitada || a.cargando) return;
    this.menuAbierto = false;
    if (!a.enlace) this.accion.emit(a.id);
  }

  alternarMenu(evento: Event): void {
    evento.stopPropagation();
    this.menuAbierto = !this.menuAbierto;
  }

  @HostListener('document:click', ['$event']) alHacerClicFuera(evento: Event): void {
    if (this.menuAbierto && !this.el.nativeElement.contains(evento.target as Node)) {
      this.menuAbierto = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:keydown.escape') alEscape(): void {
    if (this.menuAbierto) {
      this.menuAbierto = false;
      this.cdr.markForCheck();
    }
  }

  tip(a: AccionUI): string {
    return a.tooltip ?? a.etiqueta;
  }

  trackId = (_: number, a: AccionUI): string => a.id;
}
