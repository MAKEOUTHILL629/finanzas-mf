import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, finalize, takeUntil } from 'rxjs/operators';
import { FiltroTransacciones, Transaccion } from '../../modelos/erp';
import { ItemCategoria, ItemCuenta } from '../../modelos/catalogos';
import { CatalogosService } from '../../services/catalogos.service';
import { ModalService } from '../../services/modal.service';
import { TransaccionesService } from '../../services/transacciones.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { AccionUI } from '../../shared/ui/acciones/acciones.component';
import { ColumnaTabla, OrdenTabla } from '../../shared/ui/apple-table/apple-table.types';
import { DefinicionFiltro, EstadoFiltros, SegmentoFiltro, estadoVacio } from '../../shared/ui/filter-bar/filter-bar.types';
import { desplazarPeriodo, esPeriodoValido, nombrePeriodo, periodoActual } from '../../shared/periodo.helper';
import { ToastService } from '../../shared/toast/toast.service';
import {
  ESTADOS_TRANSACCION,
  TIPOS_TRANSACCION,
  TotalesTransacciones,
  claseEstadoTransaccion,
  efectoDe,
  etiquetaEstadoTransaccion,
  reglasDeTipo,
  totalesDe,
} from '../transacciones.constants';
import { ContextoTransacciones, SEGMENTOS_TX, conteoPorSegmentoTx, filtrarTransacciones } from '../transacciones-filtros';

export const MODAL_TRANSACCION = 'transaccion-form';
/** El backend admite hasta 500 por página; con un filtro mensual alcanza de sobra. */
export const LIMITE_CONSULTA = 500;

export interface FiltrosTransaccion {
  /** `YYYY-MM`; vacío = todos los periodos */
  periodo: string;
}

/** Lo único que se pide al servidor es el periodo; tipo, estado, cuenta, categoría y texto se filtran en pantalla (son a lo sumo 500 filas). */
export function filtroDeConsulta(f: FiltrosTransaccion): FiltroTransacciones {
  return {
    ...(esPeriodoValido(f.periodo) ? { periodo: f.periodo } : {}),
    limit: LIMITE_CONSULTA,
  };
}

const ETIQUETA_SEGMENTO: Record<(typeof SEGMENTOS_TX)[number], string> = {
  todas: 'Todas',
  confirmadas: 'Confirmadas',
  revision: 'Por revisar',
  anuladas: 'Anuladas',
};

@Component({
  selector: 'app-lista-transacciones',
  templateUrl: './lista-transacciones.component.html',
  styleUrl: './lista-transacciones.component.css'
})
export class ListaTransaccionesComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_TRANSACCION;
  readonly tipos = TIPOS_TRANSACCION;
  readonly estados = ESTADOS_TRANSACCION;
  readonly claseEstado = claseEstadoTransaccion;
  readonly etiquetaEstado = etiquetaEstadoTransaccion;
  readonly reglas = reglasDeTipo;
  readonly efecto = efectoDe;

  private fb = inject(FormBuilder);
  filtros = this.fb.nonNullable.group({ periodo: periodoActual() });

  items: Transaccion[] = [];
  /** Lo que queda tras la barra de filtros (alimenta la tabla y los totales). */
  filtradas: Transaccion[] = [];
  total = 0;
  totales: TotalesTransacciones = { ingresos: 0, egresos: 0, neto: 0, pendientesRevision: 0 };

  /** Barra de filtros: buscador, estados rápidos y chips (todo en memoria). */
  estadoFiltros: EstadoFiltros = estadoVacio('todas');
  segmentos: SegmentoFiltro[] = SEGMENTOS_TX.map((s) => ({ valor: s, etiqueta: ETIQUETA_SEGMENTO[s], cantidad: 0 }));
  definicionFiltros: DefinicionFiltro[] = [];

  readonly ordenInicial: OrdenTabla = { columna: 'fecha', direccion: 'desc' };
  readonly columnas: ColumnaTabla<Transaccion>[] = [
    { id: 'fecha', titulo: 'Fecha', valor: (t) => new Date(t.fecha_transaccion), formato: 'fecha', prioridad: 1, anchoMin: 135 },
    { id: 'concepto', titulo: 'Concepto', valor: (t) => t.concepto, prioridad: 1, anchoMin: 200 },
    { id: 'cuentas', titulo: 'Cuentas', valor: (t) => this.cuentasDe(t), prioridad: 2, truncar: true, anchoMin: 150 },
    { id: 'tipo', titulo: 'Tipo', valor: (t) => reglasDeTipo(t.tipo_transaccion).etiqueta, prioridad: 3, anchoMin: 135 },
    { id: 'estado', titulo: 'Estado', valor: (t) => etiquetaEstadoTransaccion(t.estado), prioridad: 1, anchoMin: 140 },
    { id: 'monto', titulo: 'Monto', valor: (t) => Number(t.monto_cop), formato: 'moneda', prioridad: 1, anchoMin: 120 },
  ];

  readonly principal: AccionUI = { id: 'nueva', etiqueta: 'Nueva transacción', icono: 'add', tooltip: 'Registrar un ingreso, egreso, transferencia o pago' };
  readonly secundarias: AccionUI[] = [{ id: 'correos', etiqueta: 'Correos', icono: 'mark_email_unread', tooltip: 'Revisar los correos del banco por conciliar', enlace: '/correos' }];

  /** Para los nombres de la tabla y los filtros (catálogos compartidos). */
  cuentas: ItemCuenta[] = [];
  categorias: ItemCategoria[] = [];

  /** Transacción en edición (null = alta). El formulario existe solo mientras el modal está abierto. */
  formularioAbierto = false;
  editando: Transaccion | null = null;
  confirmandoAnular: Transaccion | null = null;
  trabajando = false;

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor(
    private transaccionesService: TransaccionesService,
    private catalogos: CatalogosService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.atenderAccionRapida();
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) {
        this.formularioAbierto = false;
        this.editando = null;
      }
    });
    // Listas de los filtros y de los nombres de la tabla: del catálogo compartido (cada selector muestra su propio error con «Reintentar»).
    this.catalogos.estado$('cuentas').pipe(takeUntil(this.destroy$)).subscribe((e) => {
      this.cuentas = e.datos;
      this.armarFiltros();
    });
    this.catalogos.estado$('categorias').pipe(takeUntil(this.destroy$)).subscribe((e) => {
      this.categorias = e.datos;
      this.armarFiltros();
    });
    this.catalogos.asegurar(['cuentas', 'categorias']);

    this.filtros.valueChanges.pipe(debounceTime(150), takeUntil(this.destroy$)).subscribe(() => this.cargar());
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.transaccionesService
      .getTransacciones(filtroDeConsulta(this.filtros.getRawValue()))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (r) => {
          this.items = r.items;
          this.total = r.total;
          this.aplicar();
        },
        error: (err) => {
          this.items = [];
          this.total = 0;
          this.aplicar();
          this.error = mensajeDeError(err, 'No se pudieron cargar las transacciones.');
        }
      });
  }

  // ── periodo ──

  moverPeriodo(delta: number): void {
    const actual = this.filtros.controls.periodo.value;
    this.filtros.controls.periodo.setValue(desplazarPeriodo(esPeriodoValido(actual) ? actual : periodoActual(), delta));
  }

  nombrePeriodo(p: string): string {
    return nombrePeriodo(p);
  }

  // ── filtros en pantalla ──

  private readonly contexto: ContextoTransacciones = {
    nombreCuenta: (id) => this.nombreCuenta(id),
    nombreCategoria: (id) => this.nombreCategoria(id),
  };

  private armarFiltros(): void {
    this.definicionFiltros = [
      { id: 'tipos', tipo: 'seleccion', etiqueta: 'Tipo', icono: 'swap_vert', multiple: true, opciones: this.tipos.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta })) },
      { id: 'cuentas', tipo: 'seleccion', etiqueta: 'Cuenta', icono: 'account_balance', multiple: true, buscable: true, opciones: this.cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre, grupo: c.activa === false ? 'Históricas' : undefined })) },
      { id: 'categorias', tipo: 'seleccion', etiqueta: 'Categoría', icono: 'sell', multiple: true, buscable: true, opciones: this.categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre })) },
      { id: 'origen', tipo: 'seleccion', etiqueta: 'Origen', icono: 'input', multiple: true, opciones: [{ valor: 'MANUAL', etiqueta: 'Manual' }, { valor: 'EMAIL_AUTO', etiqueta: 'Desde correo' }] },
      { id: 'fechas', tipo: 'fechas', etiqueta: 'Fecha', icono: 'event' },
    ];
  }

  alFiltrar(estado: EstadoFiltros): void {
    this.estadoFiltros = estado;
    this.aplicar();
  }

  private aplicar(): void {
    this.filtradas = filtrarTransacciones(this.items, this.estadoFiltros, this.contexto);
    this.totales = totalesDe(this.filtradas);
    const c = conteoPorSegmentoTx(this.items, this.estadoFiltros, this.contexto);
    this.segmentos = SEGMENTOS_TX.map((s) => ({ valor: s, etiqueta: ETIQUETA_SEGMENTO[s], cantidad: c[s] }));
  }

  /** Las anuladas se ven atenuadas y tachadas. */
  readonly claseFila = (t: Transaccion): string => (t.estado === 'ANULADO' ? 'apt-fila--tenue' : '');

  alAccionar(id: string): void {
    if (id === 'nueva') this.nueva();
  }

  /** Un clic en la fila abre la edición (las anuladas ya no se editan). */
  abrir(t: Transaccion): void {
    if (this.puedeEditar(t)) this.editar(t);
  }

  get truncado(): boolean {
    return this.total > this.items.length;
  }

  // ── alta / edición ──

  /** El inicio enlaza con `?accion=nueva`: se abre el formulario y se limpia la URL para que recargar no lo reabra. */
  private atenderAccionRapida(): void {
    if (this.ruta.snapshot.queryParamMap.get('accion') !== 'nueva') return;
    void this.router.navigate([], { queryParams: { accion: null }, queryParamsHandling: 'merge', replaceUrl: true });
    setTimeout(() => this.nueva());
  }

  nueva(): void {
    this.editando = null;
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  editar(t: Transaccion): void {
    this.editando = t;
    this.formularioAbierto = true;
    this.modalService.open(this.modalId);
  }

  cerrarFormulario(): void {
    this.modalService.close();
  }

  onGuardada(): void {
    const eraEdicion = !!this.editando;
    this.modalService.close();
    this.toast.exito(eraEdicion ? 'Transacción actualizada.' : 'Transacción registrada.');
    this.cargar();
  }

  // ── confirmar una pendiente / anular ──

  confirmar(t: Transaccion): void {
    this.trabajando = true;
    this.transaccionesService
      .actualizarTransaccion(t.id, { estado: 'CONFIRMADO' })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.toast.exito('Transacción confirmada: el saldo de la cuenta ya se actualizó.');
          this.cargar();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo confirmar la transacción.'))
      });
  }

  pedirAnular(t: Transaccion): void {
    this.confirmandoAnular = t;
  }

  cancelarAnular(): void {
    this.confirmandoAnular = null;
  }

  confirmarAnular(): void {
    const t = this.confirmandoAnular;
    if (!t) return;
    this.trabajando = true;
    this.transaccionesService
      .anularTransaccion(t.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.confirmandoAnular = null;
          this.toast.exito('Transacción anulada: el saldo se revirtió.');
          this.cargar();
        },
        error: (err) => {
          this.confirmandoAnular = null;
          this.toast.error(mensajeDeError(err, 'No se pudo anular la transacción.'));
        }
      });
  }

  // ── presentación ──

  nombreCuenta(id: number | null): string {
    return id === null ? '' : (this.cuentas.find((c) => c.id === id)?.nombre ?? `Cuenta #${id}`);
  }

  nombreCategoria(id: number | null): string {
    return id === null ? '' : (this.categorias.find((c) => c.id === id)?.nombre ?? '');
  }

  /** "Origen → Destino" según lo que aplica al tipo. */
  cuentasDe(t: Transaccion): string {
    const o = this.nombreCuenta(t.cuenta_origen_id);
    const d = this.nombreCuenta(t.cuenta_destino_id);
    return o && d ? `${o} → ${d}` : o || d || '—';
  }

  puedeEditar(t: Transaccion): boolean {
    return t.estado !== 'ANULADO';
  }
}
