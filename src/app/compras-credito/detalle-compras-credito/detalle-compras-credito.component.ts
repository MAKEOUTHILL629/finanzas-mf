import { token } from '../../shared/design-tokens';
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ComprasCredito, ComprasCreditoMultimoneda, CuotaDetalle, months } from '../../modelos/compras-credito';
import { ItemTarjeta, OpcionSelect } from '../../modelos/catalogos';
import { DetalleRefinanciamiento } from '../../modelos/refinanciamiento';
import { PlasticoTarjeta } from '../../modelos/tarjeta';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiServicesService } from '../../services/api-services.service';
import { CambiosCompraCredito, ComprasCreditoService } from '../../services/compras-credito.service';
import { CatalogosService } from '../../services/catalogos.service';
import { ModalService } from '../../services/modal.service';
import { RefinanciamientosService } from '../../services/refinanciamientos.service';
import { TarjetasService } from '../../services/tarjetas.service';
import { formatDateOnly, partesFechaCalendario } from '../../shared/date-only.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { sumarMonedas } from '../../shared/dinero.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { AccionUI } from '../../shared/ui/acciones/acciones.component';
import { ValorCampoEditable } from '../../shared/ui/campo-editable/campo-editable.component';
import { ChartConfiguration, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { CampoFaltante, DatoFaltante, EstadoVisual, ProgresoCuotas, datosFaltantesDeCompra, estadoVisualDeCompra, progresoDeCuotas, textoDatosFaltantes } from './compra-resumen.helper';

/** Campos de la compra que se editan en el sitio. */
export type CampoCompra = 'concepto' | 'descripcion' | 'estado' | 'tarjeta' | 'plastico' | 'valorCompra' | 'fechaCompra' | 'numeroCuotas' | 'interes' | 'trm';

/** Los que cambian el valor, las cuotas, el interés, la fecha o la tarjeta: el servidor recalcula la tabla de cuotas. */
const CAMPOS_FINANCIEROS: ReadonlyArray<CampoCompra> = ['valorCompra', 'fechaCompra', 'numeroCuotas', 'interes', 'tarjeta', 'trm'];

export const MODAL_ELIMINAR_COMPRA = 'detalle-eliminar-compra';
export const MODAL_DESHACER_UNIFICACION = 'detalle-deshacer-unificacion';

export const OPCIONES_ESTADO: OpcionSelect[] = [
  { valor: 'Pendiente', etiqueta: 'Pendiente' },
  { valor: 'Pagado', etiqueta: 'Pagado' },
  { valor: 'Cancelado', etiqueta: 'Cancelado' },
];

/**
 * Detalle de una compra a crédito como un «inspector» (plan V2, fase 5): resumen arriba (valor, estado, fecha, tarjeta), aviso de lo que
 * falta por completar, tarjetas con los datos que se editan al tocarlos (cada cambio se guarda al instante con un PATCH, sin recargar ni
 * perder el lugar), avance de las cuotas y, si la compra se unificó (o es la unificación), el vínculo con su refinanciamiento.
 */
@Component({
  selector: 'app-detalle-compras-credito',
  templateUrl: './detalle-compras-credito.component.html',
  styleUrl: './detalle-compras-credito.component.css',
})
export class DetalleComprasCreditoComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private pendingNavigationState: ComprasCredito | null = null;
  private resaltadoTimer: ReturnType<typeof setTimeout> | null = null;

  compraCredito: ComprasCreditoMultimoneda | undefined;
  cuotaDetalles: CuotaDetalle[] = [];
  cargando = true;
  errorCarga: string | null = null;

  tarjetas: ItemTarjeta[] = [];
  plasticos: PlasticoTarjeta[] = [];
  refinanciamiento: DetalleRefinanciamiento | null = null;

  // ── derivados (se recalculan al cambiar la compra o sus cuotas)
  estadoVisual: EstadoVisual = estadoVisualDeCompra({});
  faltantes: DatoFaltante[] = [];
  textoFaltantes = '';
  faltantesTexto = '';
  progreso: ProgresoCuotas = progresoDeCuotas([], 0);
  totalPagado = 0;
  totalIntereses = 0;
  acciones: AccionUI[] = [];

  // ── edición en línea
  guardando = new Set<string>();
  errores: Record<string, string> = {};
  resaltando = false;
  readonly opcionesEstado = OPCIONES_ESTADO;

  // ── responsables
  hayCambiosResponsables = false;
  responsablesModificados: any[] = [];
  guardandoResponsables = false;

  // ── confirmaciones
  eliminando = false;
  deshaciendo = false;
  recalculando = false;
  readonly MODAL_ELIMINAR = MODAL_ELIMINAR_COMPRA;
  readonly MODAL_DESHACER = MODAL_DESHACER_UNIFICACION;

  public lineChartData: ChartConfiguration['data'] = {
    datasets: [
      {
        data: [],
        label: 'Interes Pagado',
        backgroundColor: token('--chart-4', '#FF3B30'),
        borderColor: token('--chart-4', '#FF3B30'),
        pointBackgroundColor: 'rgba(148,159,177,1)',
        pointBorderColor: token('--bg-surface-solid', '#fff'),
        pointHoverBackgroundColor: token('--bg-surface-solid', '#fff'),
        pointHoverBorderColor: 'rgba(148,159,177,0.8)',
        fill: 'origin',
      },
      {
        data: [],
        label: 'Saldo Restante',
        yAxisID: 'y1',
        backgroundColor: token('--chart-5', '#FF9500'),
        borderColor: token('--chart-5', '#FF9500'),
        pointBackgroundColor: 'rgba(148,159,177,1)',
        pointBorderColor: token('--bg-surface-solid', '#fff'),
        pointHoverBackgroundColor: token('--bg-surface-solid', '#fff'),
        pointHoverBorderColor: 'rgba(148,159,177,0.8)',
        fill: 'origin',
      },
      {
        data: [],
        label: 'Aporte Capital',
        backgroundColor: 'rgba(77,83,96,0.08)',
        borderColor: 'rgba(77,83,96,0.5)',
        pointBackgroundColor: 'rgba(77,83,96,1)',
        pointBorderColor: token('--bg-surface-solid', '#fff'),
        pointHoverBackgroundColor: token('--bg-surface-solid', '#fff'),
        pointHoverBorderColor: 'rgba(77,83,96,1)',
        fill: 'origin',
      },
    ],
    labels: [],
  };

  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      line: {
        tension: 0.5,
      },
    },
    scales: {
      // We use this empty structure as a placeholder for dynamic theming.
      y: {
        position: 'left',
      },
      y1: {
        position: 'right',
        grid: {
          color: token('--divider', 'rgba(0,0,0,0.08)'),
        },
        ticks: {
          color: token('--text-secondary', '#86868B'),
        },
      },
    },

    plugins: {
      legend: { display: true },
    },
  };

  public lineChartType: ChartType = 'line';

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  @ViewChild('responsableComponent') responsableComponent: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiServicesService,
    private compras: ComprasCreditoService,
    private refinanciamientos: RefinanciamientosService,
    private tarjetasService: TarjetasService,
    private catalogos: CatalogosService,
    private modal: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.catalogos.estado$('tarjetas').pipe(takeUntil(this.destroy$)).subscribe((e) => (this.tarjetas = e.datos));
    this.catalogos.asegurar(['tarjetas']);

    // Capturar el estado de la navegación sincrónicamente antes de cualquier suscripción
    const navigation = this.router.getCurrentNavigation();
    this.pendingNavigationState = (navigation?.extras?.state?.['compra'] as ComprasCredito) ?? null;

    // Suscribirse a cambios de param para soportar reutilización del componente
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = Number(params.get('id'));
      this.resetearEstado();

      // Usar estado de navegación solo en la primera carga
      const navState = this.pendingNavigationState;
      this.pendingNavigationState = null;

      if (navState?.concepto && Number(navState.id) === id) {
        this.recibirCompra(navState as ComprasCreditoMultimoneda);
      } else {
        this.cargarCompra(id);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.resaltadoTimer) clearTimeout(this.resaltadoTimer);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private resetearEstado(): void {
    this.compraCredito = undefined;
    this.cuotaDetalles = [];
    this.cargando = true;
    this.errorCarga = null;
    this.refinanciamiento = null;
    this.plasticos = [];
    this.guardando = new Set();
    this.errores = {};
    this.hayCambiosResponsables = false;
    this.responsablesModificados = [];
    this.lineChartData.datasets[0].data = [];
    this.lineChartData.datasets[1].data = [];
    this.lineChartData.datasets[2].data = [];
    this.lineChartData.labels = [];
    this.recalcularDerivados();
  }

  // ───────── carga ─────────

  cargarCompra(id: number): void {
    this.cargando = true;
    this.errorCarga = null;
    this.compras.getDetalle(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => this.recibirCompra(data),
      error: (err) => {
        this.cargando = false;
        this.errorCarga = mensajeDeError(err, 'No se pudo cargar la compra.');
      },
    });
  }

  reintentar(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) this.cargarCompra(id);
  }

  private recibirCompra(data: ComprasCreditoMultimoneda): void {
    this.compraCredito = data;
    this.cargando = false;
    this.recalcularDerivados();
    this.loadCuotas();
    this.cargarPlasticos();
    this.cargarRefinanciamiento();
  }

  loadCuotas(): void {
    if (!this.compraCredito?.id) return;
    this.compras
      .getCuotas(this.compraCredito.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.cuotaDetalles = [...data].sort((a, b) => (a.numeroCuota || 0) - (b.numeroCuota || 0));
          this.recalcularDerivados();
          this.configurarCampos();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudieron cargar las cuotas.')),
      });
  }

  /** Solo las compras que forman parte de una unificación (la maestra o las absorbidas) tienen detalle de refinanciamiento. */
  private cargarRefinanciamiento(): void {
    const c = this.compraCredito;
    this.refinanciamiento = null;
    if (!c?.id || !(c.esRefinanciamiento || (c.refinanciamientoId !== null && c.refinanciamientoId !== undefined))) return;
    this.refinanciamientos.detalle(c.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (d) => {
        this.refinanciamiento = d;
        this.recalcularDerivados();
      },
      error: () => undefined, // el vínculo se ve igual con lo que trae la compra; el detalle solo lo enriquece
    });
  }

  private cargarPlasticos(): void {
    const tarjetaId = this.compraCredito?.tarjeta;
    if (!tarjetaId) {
      this.plasticos = [];
      return;
    }
    this.tarjetasService.getPlasticos(tarjetaId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (lista) => (this.plasticos = lista),
      error: () => (this.plasticos = []),
    });
  }

  // ───────── derivados ─────────

  private recalcularDerivados(): void {
    const c = this.compraCredito;
    this.estadoVisual = c ? estadoVisualDeCompra(c, this.cuotaDetalles) : estadoVisualDeCompra({});
    this.faltantes = c ? datosFaltantesDeCompra(c) : [];
    this.textoFaltantes = textoDatosFaltantes(this.faltantes.length);
    this.faltantesTexto = this.faltantes.map((f) => f.etiqueta).join(' · ');
    this.progreso = progresoDeCuotas(this.cuotaDetalles, c?.numeroCuotas);
    this.totalPagado = sumarMonedas(this.cuotaDetalles.map((q) => q.pagoTotal));
    this.totalIntereses = sumarMonedas(this.cuotaDetalles.map((q) => q.interesPagado));
    this.acciones = this.armarAcciones();
  }

  private armarAcciones(): AccionUI[] {
    const lista: AccionUI[] = [];
    if (this.puedeRecalcular) lista.push({ id: 'recalcular', etiqueta: 'Recalcular cuotas', icono: 'calculate', tooltip: 'Volver a calcular la tabla de cuotas con los datos actuales', cargando: this.recalculando });
    if (this.puedeDeshacer) lista.push({ id: 'deshacer', etiqueta: 'Deshacer unificación', icono: 'undo', tooltip: 'Devolver las compras unificadas a como estaban', variante: 'ghost' });
    if (this.puedeEliminar) lista.push({ id: 'eliminar', etiqueta: 'Eliminar', icono: 'delete_outline', tooltip: 'Eliminar esta compra', variante: 'danger' });
    return lista;
  }

  alAccionar(id: string): void {
    if (id === 'recalcular') this.recalcularCuotas();
    else if (id === 'eliminar') this.modal.open(MODAL_ELIMINAR_COMPRA);
    else if (id === 'deshacer') this.modal.open(MODAL_DESHACER_UNIFICACION);
  }

  /** La compra fue absorbida por un refinanciamiento: ya no se modifica su plan de pagos. */
  get unificada(): boolean {
    const id = this.compraCredito?.refinanciamientoId;
    return id !== null && id !== undefined;
  }

  get esMaestra(): boolean {
    return !!this.compraCredito?.esRefinanciamiento;
  }

  /** Creada por el asistente (cuota fija): las registradas a mano antes no se pueden deshacer. */
  get puedeDeshacer(): boolean {
    return this.esMaestra && this.compraCredito?.sistemaAmortizacion === 'FRANCES';
  }

  get tieneAbsorbidas(): boolean {
    return (this.refinanciamiento?.absorbidas.length ?? 0) > 0 && this.esMaestra;
  }

  /** Valor, cuotas, interés, fecha y tarjeta: bloqueados si está unificada o es la unificación (se rehace con el asistente). */
  get finanzasBloqueadas(): boolean {
    return this.unificada || this.esMaestra;
  }

  get puedeEliminar(): boolean {
    return !!this.compraCredito && !this.unificada && !this.esMaestra;
  }

  get puedeRecalcular(): boolean {
    return !!this.compraCredito && !this.unificada;
  }

  get estadoBloqueado(): boolean {
    return this.unificada;
  }

  get noEsCop(): boolean {
    const m = this.compraCredito?.monedaOriginal;
    return !!m && m !== 'COP';
  }

  get fechaCompraIso(): string {
    const f = this.compraCredito?.fechaCompra;
    return f ? formatDateOnly(f) : '';
  }

  get nombreTarjeta(): string {
    const id = this.compraCredito?.tarjeta;
    if (!id) return '';
    const t = this.tarjetas.find((x) => x.id === id);
    return t?.etiqueta ?? t?.nombre ?? `Tarjeta ${id}`;
  }

  get opcionesPlastico(): OpcionSelect[] {
    return this.plasticos.map((p) => ({
      valor: p.id,
      etiqueta: `··${p.ultimos4}`,
      detalle: p.esActivo ? 'Vigente' : p.vigenteHasta ? `hasta ${p.vigenteHasta}` : 'Anterior',
      busqueda: p.ultimos4,
    }));
  }

  esFaltante(campo: CampoFaltante): boolean {
    return this.faltantes.some((f) => f.campo === campo);
  }

  /** Cuotas por pagar que ya fueron absorbidas por la unificación (no se cobran por separado). */
  get cuotasRefinanciadas(): number {
    return this.cuotaDetalles.filter((q) => /^(refinanci|ajuste)/i.test(q.estado ?? '')).length;
  }

  estadoCuota(q: CuotaDetalle): { texto: string; tono: 'success' | 'warning' | 'info' | 'neutral' } {
    const e = (q.estado ?? '').toLowerCase();
    if (e.startsWith('pagad')) return { texto: 'Pagada', tono: 'success' };
    if (e.startsWith('refinanci') || e.startsWith('ajuste')) return { texto: 'Refinanciada', tono: 'info' };
    if (e === 'pendiente' || e === '') return { texto: 'Pendiente', tono: 'warning' };
    return { texto: q.estado ?? '—', tono: 'neutral' };
  }

  porNumero(_: number, q: CuotaDetalle): number | undefined {
    return q.numeroCuota;
  }

  // ───────── gráfica ─────────

  configurarCampos(): void {
    this.lineChartData.datasets[0].data = [];
    this.lineChartData.datasets[1].data = [];
    this.lineChartData.datasets[2].data = [];
    this.lineChartData.labels = []; // Reset labels para evitar acumulación

    this.cuotaDetalles.forEach((cuota) => {
      this.lineChartData.datasets[0].data.push(cuota.interesPagado || 0);
      this.lineChartData.datasets[2].data.push(cuota.aporteCapital || 0);
      this.lineChartData.datasets[1].data.push(cuota.saldoRestante || 0);

      const { mes, anio } = partesFechaCalendario(cuota.fechaPago || new Date());
      this.lineChartData.labels?.push(`${months[mes]} del ${anio}`);
    });
    this.chart?.update();
  }

  // ───────── edición en línea ─────────

  /** Guarda al instante el campo que se acaba de editar (PATCH con solo ese cambio). */
  guardarCampo(campo: CampoCompra, valor: ValorCampoEditable): void {
    const compra = this.compraCredito;
    if (!compra?.id || this.guardando.has(campo)) return;
    this.errores = { ...this.errores, [campo]: '' };
    this.guardando = new Set(this.guardando).add(campo);

    const id = compra.id;
    const financiero = CAMPOS_FINANCIEROS.includes(campo);
    const peticion =
      campo === 'trm'
        ? this.apiService.patch<unknown>(`compras-credito/${id}/confirmar-trm`, { nuevaTrm: valor, confirmarDefinitivo: true })
        : this.compras.actualizarParcial(id, this.cambiosDe(campo, valor));

    peticion.pipe(takeUntil(this.destroy$)).subscribe({
      next: (respuesta) => {
        this.terminarGuardado(campo);
        if (this.compraCredito?.id !== id) return; // cambió de compra mientras guardaba
        if (campo === 'trm') {
          this.cargarCompra(id);
          return;
        }
        this.aplicarCompra(respuesta as ComprasCreditoMultimoneda, financiero || campo === 'plastico');
        if (campo === 'tarjeta') this.cargarPlasticos();
        if (financiero) this.loadCuotas();
      },
      error: (err) => {
        this.terminarGuardado(campo);
        const mensaje = mensajeDeError(err, 'No se pudo guardar el cambio.');
        this.errores = { ...this.errores, [campo]: mensaje };
        this.toast.error(mensaje);
      },
    });
  }

  private terminarGuardado(campo: CampoCompra): void {
    const siguiente = new Set(this.guardando);
    siguiente.delete(campo);
    this.guardando = siguiente;
  }

  private cambiosDe(campo: CampoCompra, valor: ValorCampoEditable): CambiosCompraCredito {
    switch (campo) {
      case 'concepto':
        return { concepto: String(valor ?? '') };
      case 'descripcion':
        return { descripcion: valor === null ? '' : String(valor) };
      case 'estado':
        return { estado: String(valor) };
      case 'tarjeta':
        return { tarjeta: Number(valor) };
      case 'plastico':
        return { plasticoId: Number(valor) };
      case 'valorCompra':
        return { valorCompra: Number(valor) };
      case 'fechaCompra':
        return { fechaCompra: String(valor) };
      case 'numeroCuotas':
        return { numeroCuotas: Number(valor) };
      case 'interes':
        return { interes: Number(valor) };
      default:
        return {};
    }
  }

  /**
   * Pone en pantalla lo que devolvió el servidor. Si cambió algo que recalcula las cuotas se entrega un objeto nuevo (el componente de
   * responsables vuelve a leer sus montos); si no, se actualiza en el sitio para no tocar lo que la persona esté haciendo allá.
   */
  private aplicarCompra(nueva: ComprasCreditoMultimoneda, objetoNuevo: boolean): void {
    if (!this.compraCredito) return;
    if (objetoNuevo) this.compraCredito = { ...this.compraCredito, ...nueva };
    else Object.assign(this.compraCredito, nueva);
    this.recalcularDerivados();
  }

  // ───────── aviso «Faltan X datos» ─────────

  /** Lleva la vista al primer dato que falta y resalta todos los que faltan un momento. */
  mostrarFaltantes(): void {
    if (this.faltantes.length === 0) return;
    this.resaltando = true;
    if (this.resaltadoTimer) clearTimeout(this.resaltadoTimer);
    this.resaltadoTimer = setTimeout(() => (this.resaltando = false), 2600);
    const primero = this.faltantes[0].campo;
    const destino = typeof document !== 'undefined' ? document.getElementById(primero === 'responsables' ? 'seccion-responsables' : `campo-${primero}`) : null;
    const reducido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    destino?.scrollIntoView?.({ behavior: reducido ? 'auto' : 'smooth', block: 'center' });
  }

  // ───────── responsables ─────────

  onCambiosResponsables(event: { hayUsuarios: boolean; cambios: any[]; responsablesModificados: any[] }): void {
    this.hayCambiosResponsables = event.hayUsuarios;
    this.responsablesModificados = event.responsablesModificados;
  }

  guardarResponsables(): void {
    if (!this.responsableComponent || this.guardandoResponsables) return;
    this.guardandoResponsables = true;
    Promise.resolve(this.responsableComponent.actualizarResponsables(this.responsablesModificados))
      .then(() => {
        this.guardandoResponsables = false;
        this.hayCambiosResponsables = false;
        this.responsablesModificados = [];
        this.toast.exito('Responsables actualizados.');
      })
      .catch((err) => {
        this.guardandoResponsables = false;
        this.toast.error(mensajeDeError(err, 'No se pudieron guardar los responsables.'));
      });
  }

  descartarResponsables(): void {
    this.responsableComponent?.resetearCambios();
  }

  /** Se agregó, quitó o guardó un responsable: cambia el % asignado de la compra, así que se vuelve a leer. */
  alCambiarResponsables(): void {
    const id = this.compraCredito?.id;
    if (!id) return;
    this.compras.getDetalle(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        if (this.compraCredito?.id !== id) return;
        // en el sitio: el componente de responsables no debe recargarse otra vez
        Object.assign(this.compraCredito, data);
        this.recalcularDerivados();
      },
    });
  }

  // ───────── acciones ─────────

  recalcularCuotas(): void {
    const c = this.compraCredito;
    if (!c?.id || this.recalculando) return;
    this.recalculando = true;
    this.acciones = this.armarAcciones();
    const compraFormateada = {
      id: c.id,
      fechaCompra: formatDateOnly(c.fechaCompra || new Date()),
      concepto: c.concepto,
      valorCompra: c.valorCompra,
      numeroCuotas: c.numeroCuotas,
      interes: c.interes,
      descripcion: c.descripcion,
      estado: c.estado,
      tarjeta: c.tarjeta,
    };
    this.apiService
      .post<CuotaDetalle[]>(`recalcular-compra-credito`, compraFormateada)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.recalculando = false;
          this.toast.exito('Cuotas recalculadas.');
          this.loadCuotas();
        },
        error: (err) => {
          this.recalculando = false;
          this.recalcularDerivados();
          this.toast.error(mensajeDeError(err, 'No se pudieron recalcular las cuotas.'));
        },
      });
  }

  cancelarEliminacion(): void {
    this.modal.close();
  }

  eliminarCompra(): void {
    if (!this.compraCredito?.id || this.eliminando) return;
    this.eliminando = true;
    this.apiService
      .delete(`compras-credito/${this.compraCredito.id}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.eliminando = false;
          this.modal.close();
          this.toast.exito('Compra eliminada.');
          this.router.navigate(['/compras-credito']);
        },
        error: (err) => {
          this.eliminando = false;
          this.modal.close();
          this.toast.error(mensajeDeError(err, 'No se pudo eliminar la compra. Inténtalo de nuevo.'));
        },
      });
  }

  deshacerUnificacion(): void {
    const id = this.compraCredito?.id;
    if (!id || this.deshaciendo) return;
    this.deshaciendo = true;
    this.refinanciamientos.deshacer(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r) => {
        this.deshaciendo = false;
        this.modal.close();
        this.toast.exito(`Unificación deshecha: ${r.restauradas} compra${r.restauradas === 1 ? '' : 's'} vuelven a cobrarse como antes.`);
        this.router.navigate(['/compras-credito']);
      },
      error: (err) => {
        this.deshaciendo = false;
        this.modal.close();
        this.toast.error(mensajeDeError(err, 'No se pudo deshacer la unificación.'));
      },
    });
  }

  cerrarModal(): void {
    this.modal.close();
  }

  irACompra(id: number | null | undefined): void {
    if (id) void this.router.navigate(['/compra-credito-detalle', id]);
  }
}
