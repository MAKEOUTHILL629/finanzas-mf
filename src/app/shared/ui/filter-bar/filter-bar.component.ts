import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  numberAttribute
} from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  DefinicionFiltro,
  EstadoFiltros,
  FiltroSeleccion,
  OpcionFiltro,
  RangoFechas,
  SegmentoFiltro,
  ValorFiltro,
  estadoVacio,
  resumenValor,
  tieneValor
} from './filter-bar.types';

interface GrupoOpciones {
  titulo: string | null;
  opciones: OpcionFiltro[];
}

/**
 * Barra de filtros inteligente: buscador en vivo (con espera de 300 ms), estados rápidos como control segmentado y filtros en «chips»
 * que abren un panel pequeño (selección con buscador, rango de fechas, interruptor, número). Muestra cuántos filtros hay activos y
 * permite limpiarlos todos de una vez. En móvil los paneles suben como hoja inferior.
 *
 *   <app-filter-bar [segmentos]="estados" [filtros]="filtros" [estado]="estado" (estadoChange)="alFiltrar($event)"></app-filter-bar>
 */
@Component({
  selector: 'app-filter-bar',
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterBarComponent implements OnInit, OnChanges, OnDestroy {
  @Input() placeholder = 'Buscar…';
  @Input() segmentos: SegmentoFiltro[] = [];
  @Input() filtros: DefinicionFiltro[] = [];
  @Input() estado: EstadoFiltros = estadoVacio();
  /** Espera tras dejar de escribir antes de avisar (ms). */
  @Input({ transform: numberAttribute }) retardoBusqueda = 300;
  @Input() etiquetaSegmentos = 'Estado';
  @Output() estadoChange = new EventEmitter<EstadoFiltros>();

  /** Texto del buscador mientras se escribe (el estado se actualiza al terminar la espera). */
  textoBusqueda = '';
  abierto: string | null = null;
  busquedaOpciones = '';

  private escritura$ = new Subject<string>();
  private sub = new Subscription();

  constructor(
    private cdr: ChangeDetectorRef,
    private el: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.escritura$.pipe(debounceTime(this.retardoBusqueda), distinctUntilChanged()).subscribe((texto) => {
        if (texto === this.estado.busqueda) return;
        this.emitir({ ...this.estado, busqueda: texto });
      })
    );
  }

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['estado']) {
      // un cambio hecho desde fuera (p. ej. «Limpiar filtros» de otra parte) también se refleja en el buscador
      if (this.textoBusqueda !== this.estado.busqueda) this.textoBusqueda = this.estado.busqueda;
      if (!this.estado.segmento && this.segmentos[0]) this.estado = { ...this.estado, segmento: this.segmentos[0].valor };
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── buscador ──

  alEscribir(texto: string): void {
    this.textoBusqueda = texto;
    this.escritura$.next(texto);
  }

  limpiarBusqueda(): void {
    this.textoBusqueda = '';
    this.emitir({ ...this.estado, busqueda: '' });
  }

  // ── segmentos ──

  elegirSegmento(valor: string): void {
    if (valor === this.estado.segmento) return;
    this.emitir({ ...this.estado, segmento: valor });
  }

  get indiceSegmento(): number {
    return Math.max(0, this.segmentos.findIndex((s) => s.valor === this.estado.segmento));
  }

  // ── chips ──

  valorDe(def: DefinicionFiltro): ValorFiltro {
    return this.estado.valores[def.id];
  }

  activo(def: DefinicionFiltro): boolean {
    return tieneValor(def, this.valorDe(def));
  }

  resumen(def: DefinicionFiltro): string {
    return resumenValor(def, this.valorDe(def));
  }

  alternarPanel(def: DefinicionFiltro, evento: Event): void {
    evento.stopPropagation();
    this.abierto = this.abierto === def.id ? null : def.id;
    this.busquedaOpciones = '';
  }

  cerrarPanel(): void {
    this.abierto = null;
  }

  @HostListener('document:click', ['$event']) alHacerClicFuera(evento: Event): void {
    if (this.abierto && !this.el.nativeElement.contains(evento.target as Node)) {
      this.abierto = null;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:keydown.escape') alEscape(): void {
    if (this.abierto) {
      this.abierto = null;
      this.cdr.markForCheck();
    }
  }

  fijar(def: DefinicionFiltro, valor: ValorFiltro): void {
    const valores = { ...this.estado.valores };
    if (tieneValor(def, valor)) valores[def.id] = valor;
    else delete valores[def.id];
    this.emitir({ ...this.estado, valores });
  }

  limpiarFiltro(def: DefinicionFiltro, evento?: Event): void {
    evento?.stopPropagation();
    this.fijar(def, null);
  }

  // selección
  opcionesVisibles(def: FiltroSeleccion): GrupoOpciones[] {
    const q = this.normalizar(this.busquedaOpciones);
    const filtradas = q ? def.opciones.filter((o) => this.normalizar(`${o.etiqueta} ${o.detalle ?? ''}`).includes(q)) : def.opciones;
    const grupos = new Map<string | null, OpcionFiltro[]>();
    for (const o of filtradas) grupos.set(o.grupo ?? null, [...(grupos.get(o.grupo ?? null) ?? []), o]);
    return [...grupos.entries()].map(([titulo, opciones]) => ({ titulo, opciones }));
  }

  elegida(def: FiltroSeleccion, o: OpcionFiltro): boolean {
    const v = this.valorDe(def);
    return Array.isArray(v) ? v.includes(o.valor) : v === o.valor;
  }

  alternarOpcion(def: FiltroSeleccion, o: OpcionFiltro): void {
    const v = this.valorDe(def);
    if (def.multiple) {
      const actuales = Array.isArray(v) ? v : [];
      this.fijar(def, actuales.includes(o.valor) ? actuales.filter((x) => x !== o.valor) : [...actuales, o.valor]);
    } else {
      this.fijar(def, this.elegida(def, o) ? null : o.valor);
      this.abierto = null;
    }
  }

  // fechas
  rango(def: DefinicionFiltro): RangoFechas {
    return (this.valorDe(def) as RangoFechas | null) ?? { desde: null, hasta: null };
  }

  cambiarFecha(def: DefinicionFiltro, lado: 'desde' | 'hasta', valor: string): void {
    this.fijar(def, { ...this.rango(def), [lado]: valor || null });
  }

  // número
  cambiarNumero(def: DefinicionFiltro, valor: string): void {
    this.fijar(def, valor === '' ? null : Number(valor));
  }

  // ── resumen ──

  get totalActivos(): number {
    return this.filtros.filter((f) => this.activo(f)).length + (this.estado.busqueda ? 1 : 0) + (this.segmentoCambiado ? 1 : 0);
  }

  private get segmentoCambiado(): boolean {
    return this.segmentos.length > 0 && this.estado.segmento !== '' && this.estado.segmento !== this.segmentos[0].valor;
  }

  limpiarTodo(): void {
    this.textoBusqueda = '';
    this.abierto = null;
    this.emitir(estadoVacio(this.segmentos[0]?.valor ?? ''));
  }

  trackId = (_: number, x: { id: string }): string => x.id;
  trackSegmento = (_: number, s: SegmentoFiltro): string => s.valor;
  trackGrupo = (_: number, g: GrupoOpciones): string => g.titulo ?? '';
  trackOpcion = (_: number, o: OpcionFiltro): string | number => o.valor;

  private emitir(nuevo: EstadoFiltros): void {
    this.estado = nuevo;
    this.estadoChange.emit(nuevo);
    this.cdr.markForCheck();
  }

  private normalizar(t: string): string {
    return (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
