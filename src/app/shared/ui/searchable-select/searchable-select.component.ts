import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { OpcionSelect } from '../../../modelos/catalogos';
import { valoresIguales } from '../select/select.helpers';
import { FilaLista, filasDeLista, filtrarOpciones, moverActiva } from './searchable-select.helpers';

export type ValorBuscable = number | string | null;

let siguienteId = 0;

/** Ancho a partir del cual la lista es un desplegable junto al campo; por debajo, una hoja inferior. */
const ANCHO_ESCRITORIO = 768;
const ALTO_MAXIMO = 320;

/**
 * Selector buscable del sistema de diseño (combobox estilo Spotlight):
 *  · al abrirlo hay un campo de búsqueda que filtra al instante por nombre, detalle y datos extra (p. ej. los últimos 4 dígitos);
 *  · las opciones pueden venir en grupos («Activas» / «Históricas»), con encabezados sutiles;
 *  · teclado completo: ↑ ↓ para moverse, Enter elige, Esc cierra, Tab sale; escribir en el campo cerrado lo abre ya buscando;
 *  · botón de limpiar (si el campo es opcional);
 *  · en pantallas angostas la lista es una hoja inferior con el buscador arriba.
 * Funciona con `formControlName` / `ngModel` y entrega el valor de la opción (número o texto) o `null`.
 */
@Component({
  selector: 'app-searchable-select',
  templateUrl: './searchable-select.component.html',
  styleUrl: './searchable-select.component.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchableSelectComponent), multi: true }],
})
export class SearchableSelectComponent implements ControlValueAccessor, OnChanges, AfterViewInit, OnDestroy {
  @Input() opciones: OpcionSelect[] = [];
  /** Valor elegido cuando se usa sin formulario (con `formControlName` no hace falta). */
  @Input() set valor(v: ValorBuscable | undefined) {
    this.valorActual = v === undefined || v === '' ? null : v;
  }
  @Input() inputId: string | null = null;
  @Input() placeholder = 'Selecciona…';
  @Input() placeholderBusqueda = 'Buscar…';
  /** Permite volver a «sin selección» (botón de limpiar). */
  @Input() permitirVacio = true;
  @Input() invalido = false;
  @Input() ariaLabel: string | null = null;
  @Input() ariaDescribedby: string | null = null;
  /** Muestra el esqueleto y no deja abrir (mientras llegan las opciones). */
  @Input() cargando = false;
  @Input() deshabilitado = false;
  /** Abre la lista en cuanto aparece (editores en línea de una celda, donde elegir es lo único que se puede hacer). */
  @Input() abrirAlMostrar = false;
  @Input() textoSinResultados = 'Sin resultados';
  /** Se emite al elegir (o limpiar) con la opción resultante. */
  @Output() elegido = new EventEmitter<OpcionSelect | null>();
  /** Se cierra la lista: el campo ya fue «tocado» (para la validación del formulario). */
  @Output() tocado = new EventEmitter<void>();

  @ViewChild('boton') boton?: ElementRef<HTMLButtonElement>;
  @ViewChild('buscador') buscador?: ElementRef<HTMLInputElement>;
  @ViewChild('lista') lista?: ElementRef<HTMLElement>;
  /**
   * La capa de la lista (velo + lista) se lleva a `<body>` al abrirla: un diálogo con `transform` o `backdrop-filter` convierte a sus
   * descendientes `fixed` en «relativos al diálogo» y la lista saldría desplazada y recortada.
   */
  @ViewChild('capa') set capaRef(el: ElementRef<HTMLElement> | undefined) {
    this.capa = el?.nativeElement;
    if (this.capa && this.capa.parentElement !== document.body) document.body.appendChild(this.capa);
  }
  private capa?: HTMLElement;

  readonly uid = `ss-${++siguienteId}`;
  valorActual: ValorBuscable = null;
  abierto = false;
  consulta = '';
  activa = -1;
  visibles: OpcionSelect[] = [];
  filas: FilaLista[] = [];
  /** Posición del desplegable en escritorio (la lista es `fixed` para que ningún contenedor con scroll la recorte). */
  estilo: Record<string, string> = {};
  hoja = false;
  private deshabilitadoPorFormulario = false;
  private alCambiarFn: (v: ValorBuscable) => void = () => undefined;
  private alTocarFn: () => void = () => undefined;

  constructor(private host: ElementRef<HTMLElement>, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    if (this.abrirAlMostrar) setTimeout(() => this.abrir());
  }

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['opciones'] && this.abierto) this.refiltrar(false);
  }

  ngOnDestroy(): void {
    this.abierto = false;
    this.capa?.remove(); // la capa vive en <body>: si el selector desaparece con la lista abierta, no puede quedar huérfana
  }

  get bloqueado(): boolean {
    return this.deshabilitado || this.deshabilitadoPorFormulario || this.cargando;
  }

  get seleccionada(): OpcionSelect | null {
    return this.valorActual === null ? null : (this.opciones.find((o) => valoresIguales(o.valor, this.valorActual)) ?? null);
  }

  get puedeLimpiar(): boolean {
    return this.permitirVacio && this.valorActual !== null && !this.bloqueado;
  }

  idOpcion(i: number): string {
    return `${this.uid}-op-${i}`;
  }

  get idActiva(): string | null {
    return this.activa >= 0 && this.activa < this.visibles.length ? this.idOpcion(this.activa) : null;
  }

  esSeleccionada(o: OpcionSelect): boolean {
    return valoresIguales(o.valor, this.valorActual);
  }

  // ── abrir / cerrar ──

  alternar(): void {
    if (this.abierto) this.cerrar(true);
    else this.abrir();
  }

  abrir(consultaInicial = ''): void {
    if (this.bloqueado || this.abierto) return;
    this.hoja = typeof window !== 'undefined' && window.innerWidth < ANCHO_ESCRITORIO;
    this.consulta = consultaInicial;
    this.abierto = true;
    this.refiltrar(true);
    this.posicionar();
    // el campo de búsqueda existe tras el siguiente ciclo de detección
    setTimeout(() => {
      this.buscador?.nativeElement.focus();
      this.mostrarActiva();
    });
  }

  cerrar(devolverFoco = false): void {
    if (!this.abierto) return;
    this.abierto = false;
    this.consulta = '';
    this.alTocarFn();
    this.tocado.emit();
    if (devolverFoco) this.boton?.nativeElement.focus();
    this.cdr.markForCheck();
  }

  @HostListener('document:click', ['$event'])
  alHacerClicFuera(e: Event): void {
    const destino = e.target as Node;
    if (this.abierto && !this.host.nativeElement.contains(destino) && !this.capa?.contains(destino)) this.cerrar();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  alMoverVentana(): void {
    if (this.abierto) this.posicionar();
  }

  private posicionar(): void {
    if (this.hoja || !this.boton) {
      this.estilo = {};
      return;
    }
    const r = this.boton.nativeElement.getBoundingClientRect();
    const debajo = window.innerHeight - r.bottom - 8;
    const encima = r.top - 8;
    const haciaArriba = debajo < 220 && encima > debajo;
    const ancho = Math.min(Math.max(r.width, 260), window.innerWidth - 16);
    const izquierda = Math.max(8, Math.min(r.left, window.innerWidth - ancho - 8));
    this.estilo = {
      left: `${izquierda}px`,
      width: `${ancho}px`,
      maxHeight: `${Math.max(160, Math.min(ALTO_MAXIMO, haciaArriba ? encima : debajo))}px`,
      ...(haciaArriba ? { bottom: `${window.innerHeight - r.top + 4}px` } : { top: `${r.bottom + 4}px` }),
    };
  }

  // ── búsqueda y teclado ──

  alEscribir(texto: string): void {
    this.consulta = texto;
    this.refiltrar(false);
  }

  private refiltrar(alAbrir: boolean): void {
    this.visibles = filtrarOpciones(this.opciones, this.consulta);
    this.filas = filasDeLista(this.visibles);
    const i = this.visibles.findIndex((o) => this.esSeleccionada(o));
    this.activa = alAbrir && !this.consulta && i >= 0 ? i : this.visibles.length > 0 ? 0 : -1;
    if (!alAbrir) setTimeout(() => this.mostrarActiva());
  }

  teclasBuscador(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.activa = moverActiva(this.activa, this.visibles.length, 1);
        this.mostrarActiva();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.activa = moverActiva(this.activa, this.visibles.length, -1);
        this.mostrarActiva();
        break;
      case 'PageDown':
        e.preventDefault();
        this.activa = moverActiva(this.activa, this.visibles.length, 8);
        this.mostrarActiva();
        break;
      case 'PageUp':
        e.preventDefault();
        this.activa = moverActiva(this.activa, this.visibles.length, -8);
        this.mostrarActiva();
        break;
      case 'Enter':
        e.preventDefault(); // no debe enviar el formulario que contiene el campo
        if (this.activa >= 0) this.elegir(this.visibles[this.activa]);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation(); // Esc cierra la lista, no el diálogo que la contiene
        this.cerrar(true);
        break;
      case 'Tab':
        this.cerrar();
        break;
    }
  }

  teclasBoton(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ' || e.key === 'F4') {
      e.preventDefault();
      this.abrir();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      this.abrir(e.key); // escribir sin abrir antes ya busca
    } else if (e.key === 'Escape' && this.abierto) {
      e.stopPropagation();
      this.cerrar();
    }
  }

  private mostrarActiva(): void {
    const id = this.idActiva;
    if (!id) return;
    (this.lista?.nativeElement.querySelector(`#${id}`) as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
  }

  // ── elegir ──

  elegir(o: OpcionSelect): void {
    if (o.deshabilitada) return;
    this.valorActual = o.valor;
    this.alCambiarFn(o.valor);
    this.elegido.emit(o);
    this.cerrar(true);
  }

  limpiar(e: Event): void {
    e.stopPropagation();
    if (!this.puedeLimpiar) return;
    this.valorActual = null;
    this.alCambiarFn(null);
    this.elegido.emit(null);
    this.boton?.nativeElement.focus();
  }

  alPasarSobre(i: number): void {
    this.activa = i;
  }

  trackFila(_: number, f: FilaLista): string {
    return f.tipo === 'grupo' ? `g:${f.nombre}` : `o:${f.opcion.valor}`;
  }

  // ── ControlValueAccessor ──

  writeValue(v: ValorBuscable | undefined): void {
    this.valorActual = v === undefined || v === '' ? null : v;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: ValorBuscable) => void): void {
    this.alCambiarFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocarFn = fn;
  }

  setDisabledState(d: boolean): void {
    this.deshabilitadoPorFormulario = d;
    if (d) this.cerrar();
    this.cdr.markForCheck();
  }
}
