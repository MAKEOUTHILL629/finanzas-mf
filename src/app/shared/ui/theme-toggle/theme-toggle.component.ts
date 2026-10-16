import { ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, ChangeDetectorRef, booleanAttribute } from '@angular/core';
import { Subscription } from 'rxjs';
import { ThemePreference, ThemeService } from '../../../services/theme.service';

interface OpcionTema {
  valor: ThemePreference;
  etiqueta: string;
  icono: string;
}

const OPCIONES: ReadonlyArray<OpcionTema> = [
  { valor: 'system', etiqueta: 'Sistema', icono: 'brightness_auto' },
  { valor: 'light', etiqueta: 'Claro', icono: 'light_mode' },
  { valor: 'dark', etiqueta: 'Oscuro', icono: 'dark_mode' },
];

/**
 * Selector de tema: «Sistema · Claro · Oscuro» con indicador deslizante (variante `segmented`) o un solo botón que alterna
 * claro/oscuro (variante `icon`). La elección se guarda en el navegador y «Sistema» sigue al sistema operativo en vivo.
 */
@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeToggleComponent implements OnInit, OnDestroy {
  /** `segmented`: tres opciones con indicador deslizante · `icon`: un botón que alterna claro/oscuro. */
  @Input() variant: 'segmented' | 'icon' = 'segmented';
  /** Muestra el texto de cada opción (en espacios angostos solo los íconos). */
  @Input({ transform: booleanAttribute }) etiquetas = true;

  readonly opciones = OPCIONES;
  preferencia: ThemePreference = 'system';
  oscuro = false;

  private sub = new Subscription();

  constructor(
    private theme: ThemeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.theme.preference$.subscribe((p) => {
        this.preferencia = p;
        this.cdr.markForCheck();
      })
    );
    this.sub.add(
      this.theme.isDarkMode$.subscribe((d) => {
        this.oscuro = d;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get indice(): number {
    return Math.max(0, OPCIONES.findIndex((o) => o.valor === this.preferencia));
  }

  elegir(valor: ThemePreference): void {
    this.theme.setPreference(valor);
  }

  alternar(): void {
    this.theme.toggle();
  }

  /** Flechas ← → (y inicio/fin) mueven la selección, como en cualquier control segmentado nativo. */
  teclado(evento: KeyboardEvent): void {
    const paso = evento.key === 'ArrowRight' || evento.key === 'ArrowDown' ? 1 : evento.key === 'ArrowLeft' || evento.key === 'ArrowUp' ? -1 : 0;
    if (paso === 0) return;
    evento.preventDefault();
    const siguiente = OPCIONES[(this.indice + paso + OPCIONES.length) % OPCIONES.length];
    this.elegir(siguiente.valor);
  }

  trackValor(_: number, o: OpcionTema): string {
    return o.valor;
  }
}
