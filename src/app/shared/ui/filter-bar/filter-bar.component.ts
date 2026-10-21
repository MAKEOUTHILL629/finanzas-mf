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
  PresetRangoFechas,
  RangoFechas,
  SegmentoFiltro,
  ValorFiltro,
  VistaFiltroGuardada,
  calcularRangoPreset,
  estadoVacio,
  resumenValor,
  tieneValor
} from './filter-bar.types';

interface GrupoOpciones {
  titulo: string | null;
  opciones: OpcionFiltro[];
}

const PREFIJO_STORAGE = 'erp_vistas_filtros_';

/**
 * Barra de filtros inteligente: buscador en vivo (con espera de 300 ms), estados rápidos como control segmentado y filtros en «chips»
 * que abren un panel pequeño (selección con buscador, rango de fechas con presets rápidos, interruptor, número), además de vistas
 * rápidas guardadas en `localStorage` (Iteración 2 — Fase 6).
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
  /** Clave opcional para persistir vistas rápidas en `localStorage` (Iteración 2 — Fase 6). */
  @Input() claveGuardado: string | null = null;
  @Output() estadoChange = new EventEmitter<EstadoFiltros>();

  readonly presetsFechas: Array<{ id: PresetRangoFechas; etiqueta: string }> = [
    { id: '7D', etiqueta: '7D' },
    { id: 'ESTE_MES', etiqueta: 'Este Mes' },
    { id: '3M', etiqueta: '3M' },
    { id: '6M', etiqueta: '6M' },
    { id: 'YTD', etiqueta: 'YTD' },
    { id: '1A', etiqueta: '1A' },
  ];

  /** Texto del buscador mientras se escribe (el estado se actualiza al terminar la espera). */
  textoBusqueda = '';
  abierto: string | null = null;
  busquedaOpciones = '';
  vistasGuardadas: VistaFiltroGuardada[] = [];

  private escritura$ = new Subject<string>();
  private sub = new Subscription();

  constructor(
    private cdr: ChangeDetectorRef,
    private el: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.cargarVistasGuardadas();
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
    if (cambios['claveGuardado']) {
      this.cargarVistasGuardadas();
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

  aplicarPresetFechas(def: DefinicionFiltro, preset: PresetRangoFechas, hoy: Date = new Date()): void {
    this.fijar(def, calcularRangoPreset(preset, hoy));
  }

  // número
  cambiarNumero(def: DefinicionFiltro, valor: string): void {
    this.fijar(def, valor === '' ? null : Number(valor));
  }

  // ── Iteración 2 — Fase 6: Vistas Rápidas / Filtros Guardados en localStorage ──

  private get storageKey(): string | null {
    return this.claveGuardado ? `${PREFIJO_STORAGE}${this.claveGuardado}` : null;
  }

  cargarVistasGuardadas(): void {
    const k = this.storageKey;
    if (!k || typeof localStorage === 'undefined') {
      this.vistasGuardadas = [];
      return;
    }
    try {
      const raw = localStorage.getItem(k);
      this.vistasGuardadas = raw ? (JSON.parse(raw) as VistaFiltroGuardada[]) : [];
    } catch {
      this.vistasGuardadas = [];
    }
  }

  guardarVistaRapida(nombre: string): VistaFiltroGuardada | null {
    const limpio = (nombre ?? '').trim();
    const k = this.storageKey;
    if (!limpio || !k) return null;
    const nueva: VistaFiltroGuardada = {
      id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      nombre: limpio,
      estado: {
        busqueda: this.estado.busqueda,
        segmento: this.estado.segmento,
        valores: { ...this.estado.valores },
      },
    };
    this.vistasGuardadas = [...this.vistasGuardadas.filter((v) => v.nombre.toLowerCase() !== limpio.toLowerCase()), nueva];
    this.persistirVistas();
    this.cdr.markForCheck();
    return nueva;
  }

  aplicarVistaRapida(vista: VistaFiltroGuardada): void {
    this.textoBusqueda = vista.estado.busqueda ?? '';
    this.abierto = null;
    this.emitir({
      busqueda: vista.estado.busqueda ?? '',
      segmento: vista.estado.segmento ?? (this.segmentos[0]?.valor ?? ''),
      valores: { ...(vista.estado.valores ?? {}) },
    });
  }

  eliminarVistaRapida(id: string, evento?: Event): void {
    evento?.stopPropagation();
    this.vistasGuardadas = this.vistasGuardadas.filter((v) => v.id !== id);
    this.persistirVistas();
    this.cdr.markForCheck();
  }

  private persistirVistas(): void {
    const k = this.storageKey;
    if (!k || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(k, JSON.stringify(this.vistasGuardadas));
    } catch {
      // ignora errores de cuota en storage
    }
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
    return (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
}
