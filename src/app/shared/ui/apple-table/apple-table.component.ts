import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  ContentChildren,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  QueryList,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  booleanAttribute,
  numberAttribute
} from '@angular/core';
import { FormatoFechaCortaPipe } from '../../../pipes/formato-fecha-corta.pipe';
import { FormatoFechaPipe } from '../../../pipes/formato-fecha.pipe';
import { EXPANDIR } from '../../motion';
import { moneda } from '../../moneda.util';
import {
  AccionesFilaDirective,
  CambioPagina,
  CeldaTablaDirective,
  ColumnaTabla,
  DireccionOrden,
  OrdenTabla,
  TarjetaFilaDirective,
  ValorCelda
} from './apple-table.types';

const FECHA = new FormatoFechaPipe();
const FECHA_CORTA = new FormatoFechaCortaPipe();
/** Debajo de este ancho de la propia tabla (no de la ventana) las filas pasan a tarjetas. */
export const ANCHO_MOVIL = 640;
const ANCHO_ACCIONES = 120;
const CLAVE_ALMACEN = 'finanzas-tabla-';
let contadorTablas = 0;

interface Preferencias {
  ocultas?: string[];
  tamano?: number;
}

/** Texto de una celda según su formato (también se usa para ordenar texto y para el título de las celdas cortadas). */
export function formatearCelda(valor: ValorCelda, formato: ColumnaTabla['formato'] = 'texto'): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  switch (formato) {
    case 'moneda':
      return moneda(Number(valor));
    case 'numero':
      return Number.isFinite(Number(valor)) ? Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '—';
    case 'porcentaje':
      return Number.isFinite(Number(valor)) ? `${Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 2 })} %` : '—';
    case 'fecha':
      return FECHA.transform(valor as string | number | Date) || '—';
    case 'fechaCorta':
      return FECHA_CORTA.transform(valor as string | number | Date);
    default:
      return String(valor);
  }
}

/** Compara dos valores de celda: números por magnitud, fechas por tiempo y texto en español (sin importar tildes ni mayúsculas); vacíos al final. */
export function compararValores(a: ValorCelda, b: ValorCelda): number {
  const vacio = (v: ValorCelda) => v === null || v === undefined || v === '';
  if (vacio(a) && vacio(b)) return 0;
  if (vacio(a)) return 1;
  if (vacio(b)) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
}

/**
 * Tabla del sistema de diseño para TODAS las listas de la aplicación.
 *  · Sin scroll horizontal: según el ancho que tiene, oculta las columnas menos importantes (`prioridad`) y, en pantallas
 *    angostas, pasa cada fila a una tarjeta con lo esencial y el resto al expandirla.
 *  · Paginación (10/25/50/100) con total de registros, ordenamiento por columna (ascendente → descendente → sin orden) y selector
 *    de «Columnas ▾» cuya elección se recuerda en el navegador.
 *  · Modo cliente (por defecto: pagina y ordena en memoria) o `servidor` (solo pinta y avisa de los cambios).
 *
 *   <app-apple-table [columnas]="columnas" [filas]="compras" clave="id" almacenamiento="compras" (filaClick)="abrir($event)">
 *     <ng-template appCelda="estado" let-fila>…</ng-template>
 *     <ng-template appAccionesFila let-fila>…</ng-template>
 *   </app-apple-table>
 */
@Component({
  selector: 'app-apple-table',
  templateUrl: './apple-table.component.html',
  styleUrl: './apple-table.component.css',
  animations: [EXPANDIR],
  changeDetection: ChangeDetectionStrategy.OnPush
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class AppleTableComponent<T = any> implements OnChanges, AfterViewInit, AfterViewChecked, OnDestroy {
  @Input({ required: true }) columnas: ColumnaTabla<T>[] = [];
  @Input({ required: true }) filas: T[] = [];
  /** Propiedad que identifica a cada fila (para el `trackBy` y la tarjeta expandida). */
  @Input() clave: keyof T | ((fila: T) => string | number) = 'id' as keyof T;
  @Input({ transform: booleanAttribute }) cargando = false;
  /** Texto accesible de la tabla. */
  @Input() etiqueta = 'Tabla de datos';
  /** Con un nombre, el tamaño de página y las columnas ocultas se recuerdan en el navegador. */
  @Input() almacenamiento: string | null = null;
  @Input() tamanosPagina: number[] = [10, 25, 50, 100];
  @Input({ transform: numberAttribute }) tamanoPagina = 25;
  @Input({ transform: booleanAttribute }) filaClicable = false;
  @Input() filaClase: ((fila: T) => string | null | undefined) | null = null;
  @Input() ordenInicial: OrdenTabla | null = null;
  @Input() textoVacio = 'No hay registros para mostrar.';
  @Input() unidad: [string, string] = ['registro', 'registros'];
  /** Modo servidor: `filas` ya es la página actual; la tabla no recorta ni ordena, avisa con `(paginaChange)` y `(ordenChange)`. */
  @Input({ transform: booleanAttribute }) servidor = false;
  /** Total de registros (solo modo servidor). */
  @Input({ transform: numberAttribute }) total = 0;
  /** Página actual, empezando en 0 (solo modo servidor). */
  @Input({ transform: numberAttribute }) pagina = 0;
  @Input({ transform: booleanAttribute }) sinBarra = false;
  /** Id de la columna que hace de título de la tarjeta en móvil (por defecto, la primera de prioridad 1). */
  @Input() columnaTitulo: string | null = null;
  /** Ancho (px) que se reserva para la columna de acciones al decidir cuántas columnas caben. */
  @Input({ transform: numberAttribute }) anchoAcciones = ANCHO_ACCIONES;
  /** Fila de totales al pie (solo escritorio): texto por id de columna, p. ej. `{ persona: 'Total', saldo: '$1.200' }`. */
  @Input() pie: Record<string, string> | null = null;

  @Output() filaClick = new EventEmitter<T>();
  @Output() paginaChange = new EventEmitter<CambioPagina>();
  @Output() ordenChange = new EventEmitter<OrdenTabla | null>();

  @ContentChildren(CeldaTablaDirective) private celdas!: QueryList<CeldaTablaDirective>;
  @ContentChild(AccionesFilaDirective) acciones?: AccionesFilaDirective;
  @ContentChild(TarjetaFilaDirective) tarjeta?: TarjetaFilaDirective;
  @ViewChild('raiz', { static: true }) private raiz!: ElementRef<HTMLElement>;

  /** Identificador único para enlazar etiquetas con sus controles. */
  readonly uid = `apt-${++contadorTablas}`;
  orden: OrdenTabla | null = null;
  movil = false;
  /** Ancho disponible para la tabla (px). */
  ancho = 0;
  menuColumnas = false;
  private ocultasPorUsuario = new Set<string>();
  private paginaLocal = 0;
  private tamanoActual = 25;
  private expandidas = new Set<string | number>();
  private observador: ResizeObserver | null = null;
  private listo = false;

  // vistas calculadas (se recalculan al cambiar las entradas, no en cada detección de cambios)
  mostradas: ColumnaTabla<T>[] = [];
  ocultasPorEspacio = 0;
  /** Columnas que se quitaron tras comprobar que la tabla real no cabía (el cálculo por `anchoMin` es solo una primera estimación). */
  private autoOcultas = new Set<string>();
  private revisarAjuste = false;
  principales: ColumnaTabla<T>[] = [];
  filasPagina: T[] = [];
  totalRegistros = 0;
  totalPaginas = 1;
  paginaVisible = 0;
  numerosPagina: number[] = [];

  constructor(
    private cdr: ChangeDetectorRef,
    private zona: NgZone
  ) {}

  ngOnChanges(cambios: SimpleChanges): void {
    if (!this.listo || cambios['almacenamiento'] || cambios['tamanoPagina']) {
      this.leerPreferencias();
      this.listo = true;
    }
    if (cambios['ordenInicial'] && this.ordenInicial && !this.orden) this.orden = this.ordenInicial;
    if (cambios['pagina'] && this.servidor) this.paginaLocal = this.pagina;
    if (cambios['columnas'] || cambios['filas'] || cambios['anchoAcciones']) this.autoOcultas.clear();
    if (cambios['columnas'] || cambios['filas'] || cambios['servidor'] || cambios['total'] || cambios['pagina'] || cambios['tamanoPagina'] || cambios['ordenInicial'] || cambios['anchoAcciones']) this.recalcular();
  }

  ngAfterViewInit(): void {
    this.medir(this.raiz.nativeElement.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    this.zona.runOutsideAngular(() => {
      this.observador = new ResizeObserver((entradas) => {
        const w = Math.round(entradas[0]?.contentRect.width ?? 0);
        if (w === this.ancho) return;
        this.zona.run(() => this.medir(w));
      });
      this.observador.observe(this.raiz.nativeElement);
    });
  }

  ngAfterViewChecked(): void {
    if (!this.revisarAjuste) return;
    this.revisarAjuste = false;
    this.ajustarPorDesborde();
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }

  /**
   * Comprobación real: si la tabla pintada es más ancha que su contenedor se quita la columna menos importante y se repite
   * (todo en el mismo ciclo, antes de que el navegador pinte, así no hay parpadeo ni scroll horizontal).
   */
  private ajustarPorDesborde(): void {
    if (this.movil || this.ancho <= 0) return;
    const raiz = this.raiz.nativeElement;
    for (let i = 0; i < this.columnas.length; i++) {
      const contenedor = raiz.querySelector<HTMLElement>('.apt-contenedor');
      const tabla = raiz.querySelector<HTMLElement>('.apt-tabla');
      if (!contenedor || !tabla || tabla.offsetWidth <= contenedor.clientWidth + 1) break;
      const deDerechaAIzquierda = [...this.mostradas].reverse();
      const quitable = deDerechaAIzquierda.find((c) => (c.prioridad ?? 2) === 3) ?? deDerechaAIzquierda.find((c) => (c.prioridad ?? 2) === 2);
      if (!quitable) break;
      this.autoOcultas.add(quitable.id);
      this.recalcular();
      this.cdr.detectChanges();
    }
    this.revisarAjuste = false;
  }

  // ───────────── contenido ─────────────

  plantillaDe(c: ColumnaTabla<T>): TemplateRef<unknown> | null {
    return this.celdas?.find((x) => x.columna === c.id)?.plantilla ?? null;
  }

  valorDe(c: ColumnaTabla<T>, fila: T): ValorCelda {
    return c.valor ? c.valor(fila) : undefined;
  }

  textoDe(c: ColumnaTabla<T>, fila: T): string {
    return formatearCelda(this.valorDe(c, fila), c.formato);
  }

  alineacionDe(c: ColumnaTabla<T>): string {
    const a = c.alineacion ?? (c.formato === 'moneda' || c.formato === 'numero' || c.formato === 'porcentaje' ? 'fin' : 'inicio');
    return `apt-${a}`;
  }

  esOrdenable(c: ColumnaTabla<T>): boolean {
    return c.ordenable ?? (!!c.valor || !!c.comparar);
  }

  claveDe(fila: T): string | number {
    return typeof this.clave === 'function' ? this.clave(fila) : (fila[this.clave] as unknown as string | number);
  }

  trackFila = (_: number, fila: T): string | number => this.claveDe(fila);
  trackColumna = (_: number, c: ColumnaTabla<T>): string => c.id;

  /** Columnas que el usuario puede mostrar/ocultar. */
  get configurables(): ColumnaTabla<T>[] {
    return this.columnas.filter((c) => (c.prioridad ?? 2) !== 1);
  }

  estaVisible(c: ColumnaTabla<T>): boolean {
    return !this.ocultasPorUsuario.has(c.id);
  }

  alternarColumna(c: ColumnaTabla<T>): void {
    if (this.ocultasPorUsuario.has(c.id)) this.ocultasPorUsuario.delete(c.id);
    else this.ocultasPorUsuario.add(c.id);
    this.guardarPreferencias();
    this.recalcular();
  }

  restablecerColumnas(): void {
    this.ocultasPorUsuario = new Set(this.columnas.filter((c) => c.ocultaPorDefecto).map((c) => c.id));
    this.guardarPreferencias();
    this.recalcular();
  }

  alternarMenuColumnas(evento?: Event): void {
    evento?.stopPropagation();
    this.menuColumnas = !this.menuColumnas;
  }

  @HostListener('document:click', ['$event']) alHacerClicFuera(evento: Event): void {
    if (this.menuColumnas && !(evento.target as HTMLElement | null)?.closest?.('.apt-columnas')) {
      this.menuColumnas = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:keydown.escape') alEscape(): void {
    if (this.menuColumnas) {
      this.menuColumnas = false;
      this.cdr.markForCheck();
    }
  }

  // ───────────── orden ─────────────

  direccionDe(c: ColumnaTabla<T>): DireccionOrden | null {
    return this.orden?.columna === c.id ? this.orden.direccion : null;
  }

  ariaSort(c: ColumnaTabla<T>): string | null {
    if (!this.esOrdenable(c)) return null;
    const d = this.direccionDe(c);
    return d === 'asc' ? 'ascending' : d === 'desc' ? 'descending' : 'none';
  }

  /** asc → desc → sin orden. */
  ordenar(c: ColumnaTabla<T>): void {
    if (!this.esOrdenable(c)) return;
    const d = this.direccionDe(c);
    this.orden = d === null ? { columna: c.id, direccion: 'asc' } : d === 'asc' ? { columna: c.id, direccion: 'desc' } : null;
    this.paginaLocal = 0;
    this.recalcular();
    this.ordenChange.emit(this.orden);
    if (this.servidor) this.paginaChange.emit({ pagina: 0, tamano: this.tamanoActual });
  }

  /** En móvil no hay encabezados: se ordena con un selector. */
  ordenarPorId(id: string): void {
    const c = this.columnas.find((x) => x.id === id);
    if (!c) {
      this.orden = null;
      this.recalcular();
      this.ordenChange.emit(null);
      return;
    }
    this.orden = { columna: c.id, direccion: this.orden?.columna === c.id ? this.orden.direccion : 'asc' };
    this.paginaLocal = 0;
    this.recalcular();
    this.ordenChange.emit(this.orden);
  }

  invertirOrden(): void {
    if (!this.orden) return;
    this.orden = { columna: this.orden.columna, direccion: this.orden.direccion === 'asc' ? 'desc' : 'asc' };
    this.recalcular();
    this.ordenChange.emit(this.orden);
  }

  get ordenables(): ColumnaTabla<T>[] {
    return this.columnas.filter((c) => this.esOrdenable(c));
  }

  // ───────────── paginación ─────────────

  get tamanoVisible(): number {
    return this.tamanoActual;
  }

  irAPagina(n: number): void {
    const destino = Math.min(Math.max(0, n), this.totalPaginas - 1);
    if (destino === this.paginaVisible) return;
    this.paginaLocal = destino;
    this.recalcular();
    if (this.servidor) this.paginaChange.emit({ pagina: destino, tamano: this.tamanoActual });
  }

  cambiarTamano(valor: string | number): void {
    const t = Number(valor);
    if (!this.tamanosPagina.includes(t)) return;
    this.tamanoActual = t;
    this.paginaLocal = 0;
    this.guardarPreferencias();
    this.recalcular();
    if (this.servidor) this.paginaChange.emit({ pagina: 0, tamano: t });
  }

  get desde(): number {
    return this.totalRegistros === 0 ? 0 : this.paginaVisible * this.tamanoActual + 1;
  }

  get hasta(): number {
    return Math.min(this.totalRegistros, (this.paginaVisible + 1) * this.tamanoActual);
  }

  get textoContador(): string {
    const n = this.totalRegistros;
    return `${n.toLocaleString('es-CO')} ${n === 1 ? this.unidad[0] : this.unidad[1]}`;
  }

  // ───────────── filas ─────────────

  clicEnFila(fila: T, evento?: Event): void {
    if (!this.filaClicable) return;
    // un enlace, botón o campo dentro de la fila hace lo suyo y no abre la fila
    if ((evento?.target as HTMLElement | null)?.closest?.('button, a, input, select, textarea, label')) return;
    this.filaClick.emit(fila);
  }

  teclaEnFila(evento: KeyboardEvent, fila: T): void {
    if (!this.filaClicable || (evento.key !== 'Enter' && evento.key !== ' ')) return;
    if ((evento.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    evento.preventDefault();
    this.filaClick.emit(fila);
  }

  clasesFila(fila: T): string {
    return [this.filaClicable ? 'apt-fila--clicable' : '', this.filaClase?.(fila) ?? ''].filter(Boolean).join(' ');
  }

  estaExpandida(fila: T): boolean {
    return this.expandidas.has(this.claveDe(fila));
  }

  alternarExpandida(fila: T, evento?: Event): void {
    evento?.stopPropagation();
    const k = this.claveDe(fila);
    if (!this.expandidas.delete(k)) this.expandidas.add(k);
  }

  /** Columnas que van dentro de la tarjeta expandida (todas las que no son el resumen de la tarjeta). */
  get detalleMovil(): ColumnaTabla<T>[] {
    const ids = new Set([...this.principales, this.tituloMovil].map((c) => c?.id));
    return this.columnas.filter((c) => !ids.has(c.id) && this.estaVisible(c));
  }

  get tituloMovil(): ColumnaTabla<T> | null {
    const elegida = this.columnaTitulo ? this.columnas.find((c) => c.id === this.columnaTitulo) : undefined;
    return elegida ?? this.principales[0] ?? null;
  }

  /** Resto de columnas del resumen de la tarjeta (todas las de prioridad 1 menos el título). */
  get metaMovil(): ColumnaTabla<T>[] {
    const titulo = this.tituloMovil;
    return this.principales.filter((c) => c !== titulo);
  }

  // ───────────── cálculo ─────────────

  private medir(ancho: number): void {
    this.ancho = ancho;
    this.autoOcultas.clear();
    const m = ancho > 0 && ancho < ANCHO_MOVIL;
    this.movil = m;
    this.recalcular();
    this.cdr.markForCheck();
  }

  private recalcular(): void {
    // columnas que el usuario no ocultó
    const elegidas = this.columnas.filter((c) => this.estaVisible(c));
    this.revisarAjuste = true;
    this.principales = this.columnas.filter((c) => (c.prioridad ?? 2) === 1);
    if (this.principales.length === 0 && this.columnas[0]) this.principales = [this.columnas[0]];

    // cuántas caben: se descartan primero las de prioridad 3 y luego las de 2 (de derecha a izquierda)
    let fuera = 0;
    let cabe = elegidas.filter((c) => !this.autoOcultas.has(c.id));
    fuera += elegidas.length - cabe.length;
    if (!this.movil && this.ancho > 0) {
      const necesario = () => cabe.reduce((s, c) => s + (c.anchoMin ?? 120), 0) + (this.acciones ? this.anchoAcciones : 0);
      for (const prioridad of [3, 2] as const) {
        for (let i = cabe.length - 1; i >= 0 && necesario() > this.ancho; i--) {
          if ((cabe[i].prioridad ?? 2) === prioridad) {
            cabe = cabe.filter((_, j) => j !== i);
            fuera++;
          }
        }
      }
    }
    this.mostradas = cabe;
    this.ocultasPorEspacio = fuera;

    // orden, página
    let filas = this.filas ?? [];
    if (!this.servidor) {
      const c = this.orden ? this.columnas.find((x) => x.id === this.orden!.columna) : undefined;
      if (c && this.orden) {
        const sentido = this.orden.direccion === 'asc' ? 1 : -1;
        filas = [...filas].sort((a, b) => sentido * (c.comparar ? c.comparar(a, b) : compararValores(c.valor?.(a), c.valor?.(b))));
      }
    }
    this.totalRegistros = this.servidor ? this.total : filas.length;
    this.totalPaginas = Math.max(1, Math.ceil(this.totalRegistros / this.tamanoActual));
    this.paginaVisible = Math.min(this.paginaLocal, this.totalPaginas - 1);
    this.paginaLocal = this.paginaVisible;
    this.filasPagina = this.servidor ? filas : filas.slice(this.paginaVisible * this.tamanoActual, (this.paginaVisible + 1) * this.tamanoActual);
    this.numerosPagina = this.ventanaDePaginas(this.paginaVisible, this.totalPaginas);
    this.cdr.markForCheck();
  }

  /** Hasta 5 números de página alrededor de la actual. */
  private ventanaDePaginas(actual: number, total: number): number[] {
    const largo = Math.min(5, total);
    let inicio = Math.max(0, actual - Math.floor(largo / 2));
    inicio = Math.min(inicio, total - largo);
    return Array.from({ length: largo }, (_, i) => inicio + i);
  }

  // ───────────── preferencias ─────────────

  private leerPreferencias(): void {
    const porDefecto = new Set(this.columnas.filter((c) => c.ocultaPorDefecto).map((c) => c.id));
    this.ocultasPorUsuario = porDefecto;
    this.tamanoActual = this.tamanosPagina.includes(this.tamanoPagina) ? this.tamanoPagina : this.tamanosPagina[1] ?? this.tamanosPagina[0];
    if (!this.almacenamiento) return;
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_ALMACEN + this.almacenamiento) ?? 'null') as Preferencias | null;
      if (guardado?.ocultas) this.ocultasPorUsuario = new Set(guardado.ocultas);
      if (guardado?.tamano && this.tamanosPagina.includes(guardado.tamano)) this.tamanoActual = guardado.tamano;
    } catch {
      /* almacenamiento no disponible o dañado: valores por defecto */
    }
  }

  private guardarPreferencias(): void {
    if (!this.almacenamiento) return;
    try {
      localStorage.setItem(CLAVE_ALMACEN + this.almacenamiento, JSON.stringify({ ocultas: [...this.ocultasPorUsuario], tamano: this.tamanoActual } satisfies Preferencias));
    } catch {
      /* sin almacenamiento: la preferencia vale solo para esta sesión */
    }
  }
}
