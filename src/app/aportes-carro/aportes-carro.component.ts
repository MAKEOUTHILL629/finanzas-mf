import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AporteDiario, DetalleAporteDiario, EliminadoAporteDiario, MetodoCanonico, PeriodoCarro, ResumenCarro, ResultadoAplicarExcedente, ResultadoAporteDiario, ResultadoGuardarPeriodo } from '../modelos/aportes';
import { OpcionSelect } from '../modelos/catalogos';
import { AportesCarroService } from '../services/aportes-carro.service';
import { ModalService } from '../services/modal.service';
import { mensajeDeError } from '../shared/http-error.helper';
import { moneda } from '../shared/moneda.util';
import { nombrePeriodo, periodoActual } from '../shared/periodo.helper';
import { ToastService } from '../shared/toast/toast.service';
import {
  ChipAporte,
  FiltrosAportes,
  SIN_FILTROS,
  chipsDeAporte,
  claseEstadoPeriodo,
  esDeOtroMes,
  etiquetaEstadoPeriodo,
  etiquetaMetodo,
  filtrarPeriodos,
  hayFiltros,
  iconoMetodo,
  personasEnAportes,
  textoEstadoPeriodo,
} from './aportes-carro.constants';
import { iniciales } from '../deudas/deudas.constants';
import { AccionUI, ListaAcciones } from '../shared/ui/acciones/acciones.component';

export const MODAL_APORTE_CARRO = 'aporte-carro-form';
export const MODAL_PERIODO_CARRO = 'aporte-carro-periodo';
export const MODAL_EXCEDENTE_CARRO = 'aporte-carro-excedente';

@Component({
  selector: 'app-aportes-carro',
  templateUrl: './aportes-carro.component.html',
  styleUrl: './aportes-carro.component.css'
})
export class AportesCarroComponent implements OnInit, OnDestroy {
  readonly secundarias: AccionUI[] = [
    { id: 'liquidacion', etiqueta: 'Liquidación', icono: 'fact_check', enlace: '/liquidacion', variante: 'ghost', tooltip: 'Ver la liquidación de fin de mes' },
    { id: 'periodo', etiqueta: 'Configurar cuota mensual', icono: 'tune', tooltip: 'Definir la cuota que se debe cubrir cada mes' },
  ];
  private readonly accPrincipal = new ListaAcciones();
  /** Se bloquea mientras carga o si falló la carga. */
  get principal(): AccionUI {
    return this.accPrincipal.obtener(String(this.cargando || !!this.error), () => [
      { id: 'aporte', etiqueta: 'Agregar aporte', icono: 'add', tooltip: 'Registrar un aporte diario a la cuota del mes', deshabilitada: this.cargando || !!this.error },
    ])[0];
  }

  alAccionar(id: string): void {
    if (id === 'periodo') this.abrirPeriodo();
    else if (id === 'aporte') this.abrirAporte();
  }

  readonly modalAporte = MODAL_APORTE_CARRO;
  readonly modalPeriodo = MODAL_PERIODO_CARRO;
  readonly modalExcedente = MODAL_EXCEDENTE_CARRO;

  readonly etiquetaEstado = etiquetaEstadoPeriodo;
  readonly claseEstado = claseEstadoPeriodo;
  readonly textoEstado = textoEstadoPeriodo;
  readonly chipsDe = chipsDeAporte;
  readonly etiquetaMetodo = etiquetaMetodo;
  readonly iconoMetodo = iconoMetodo;
  readonly nombrePeriodo = nombrePeriodo;
  readonly iniciales = iniciales;
  readonly hoy = periodoActual();

  resumen: ResumenCarro | null = null;
  cargando = true;
  error: string | null = null;

  /** Mes de los indicadores superiores. */
  periodoKpiId: number | null = null;
  filtros: FiltrosAportes = { ...SIN_FILTROS };
  readonly metodosFiltro: Array<{ valor: MetodoCanonico; etiqueta: string }> = [
    { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
    { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
    { valor: 'CRUCE_CUENTAS', etiqueta: 'Cruce de cuentas' },
    { valor: 'SALDO_A_FAVOR', etiqueta: 'Saldo a favor' },
    { valor: 'OTRO', etiqueta: 'Otros' },
  ];

  /** Periodos desplegados y aportes con el desglose visible. */
  abiertos = new Set<number>();
  conDesglose = new Set<number>();

  // Formularios (existen solo mientras su modal está abierto)
  aporteAbierto = false;
  aporteEnEdicion: AporteDiario | null = null;
  periodoDelFormulario: string | null = null;
  periodoAbierto = false;
  excedenteAbierto = false;
  periodoExcedenteId: number | null = null;

  /** Aporte pendiente de confirmar su eliminación. */
  eliminando: AporteDiario | null = null;
  trabajando = false;

  private destroy$ = new Subject<void>();

  constructor(
    private aportesService: AportesCarroService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalAporte) {
        this.aporteAbierto = false;
        this.aporteEnEdicion = null;
      }
      if (id !== this.modalPeriodo) this.periodoAbierto = false;
      if (id !== this.modalExcedente) this.excedenteAbierto = false;
    });
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.aportesService
      .getResumen()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (r) => {
          this.resumen = r;
          // Se conserva el mes de los indicadores si sigue existiendo; si no, el que sugiere el backend.
          const sigue = r.periodos.some((p) => p.id === this.periodoKpiId);
          this.periodoKpiId = sigue ? this.periodoKpiId : r.periodoSeleccionadoId;
          if (this.abiertos.size === 0 && this.periodoKpiId !== null) this.abiertos.add(this.periodoKpiId);
        },
        error: (err) => {
          this.resumen = null;
          this.error = mensajeDeError(err, 'No se pudo cargar los aportes del carro.');
        }
      });
  }

  // ── derivados ──

  get periodos(): PeriodoCarro[] {
    return this.resumen?.periodos ?? [];
  }

  get visibles(): PeriodoCarro[] {
    return filtrarPeriodos(this.periodos, this.filtros);
  }

  get periodoKpi(): PeriodoCarro | null {
    return this.periodos.find((p) => p.id === this.periodoKpiId) ?? null;
  }

  /** ¿Existe ya el periodo del mes en curso? Si no, se invita a configurar su cuota. */
  get faltaPeriodoActual(): boolean {
    return !!this.resumen && this.resumen.periodos.length > 0 && !this.periodos.some((p) => p.periodo === this.hoy);
  }

  get personasFiltro(): Array<{ id: number; nombre: string }> {
    return personasEnAportes(this.periodos);
  }

  private opcionesPersonasCache: { origen: Array<{ id: number; nombre: string }>; opciones: OpcionSelect[] } | null = null;

  /** Personas que aparecen en los aportes, como opciones del buscador (misma lista mientras no cambien los aportes). */
  get opcionesPersonasFiltro(): OpcionSelect[] {
    const origen = this.personasFiltro;
    const previo = this.opcionesPersonasCache;
    if (!previo || previo.origen.length !== origen.length || previo.origen.some((p, i) => p.id !== origen[i].id)) {
      this.opcionesPersonasCache = { origen, opciones: origen.map((p) => ({ valor: p.id, etiqueta: p.nombre })) };
    }
    return (this.opcionesPersonasCache as { opciones: OpcionSelect[] }).opciones;
  }

  get filtrando(): boolean {
    return hayFiltros(this.filtros);
  }

  get periodosConExcedente(): PeriodoCarro[] {
    return this.periodos.filter((p) => p.saldoAFavorDisponible > 0);
  }

  get responsableNombre(): string {
    return this.resumen?.responsable?.nombre ?? 'el responsable';
  }

  reiniciarFiltros(): void {
    this.filtros = { ...SIN_FILTROS };
  }

  cambiarFiltro<K extends keyof FiltrosAportes>(clave: K, valor: FiltrosAportes[K]): void {
    this.filtros = { ...this.filtros, [clave]: valor === ('' as unknown) ? null : valor };
  }

  // ── acordeón ──

  estaAbierto(p: PeriodoCarro): boolean {
    return this.filtrando || this.abiertos.has(p.id);
  }

  alternar(p: PeriodoCarro): void {
    if (this.abiertos.has(p.id)) this.abiertos.delete(p.id);
    else this.abiertos.add(p.id);
  }

  alternarDesglose(a: AporteDiario): void {
    if (this.conDesglose.has(a.id)) this.conDesglose.delete(a.id);
    else this.conDesglose.add(a.id);
  }

  otroMes(a: AporteDiario, p: PeriodoCarro): boolean {
    return esDeOtroMes(a, p.periodo);
  }

  cerrarModal(): void {
    this.modalService.close();
  }

  // ── aporte diario ──

  abrirAporte(aporte: AporteDiario | null = null, periodo: string | null = null): void {
    this.aporteEnEdicion = aporte;
    this.periodoDelFormulario = aporte ? aporte.periodo : periodo ?? this.periodoKpi?.periodo ?? this.hoy;
    this.aporteAbierto = true;
    this.modalService.open(this.modalAporte);
  }

  onAporteGuardado(r: ResultadoAporteDiario): void {
    const edito = !!this.aporteEnEdicion;
    this.modalService.close();
    const extras: string[] = [];
    if (r.crucesGenerados > 0) extras.push(`${r.crucesGenerados} cruce${r.crucesGenerados === 1 ? '' : 's'} cargado${r.crucesGenerados === 1 ? '' : 's'} a su cuenta por cobrar`);
    if (r.transaccionesCreadas > 0) extras.push(`${r.transaccionesCreadas} ingreso${r.transaccionesCreadas === 1 ? '' : 's'} a tus cuentas`);
    this.toast.exito(`Aporte ${edito ? 'actualizado' : 'registrado'}: ${moneda(r.aporteDiario.valorTotal)} en ${nombrePeriodo(r.periodo.periodo)}${extras.length ? ' · ' + extras.join(' · ') : ''}.`);
    this.periodoKpiId = r.periodo.id;
    this.abiertos.add(r.periodo.id);
    this.cargar();
  }

  pedirEliminar(a: AporteDiario): void {
    this.eliminando = a;
  }

  cancelarEliminar(): void {
    this.eliminando = null;
  }

  /** Qué se va a deshacer al eliminar (para el aviso de confirmación). */
  efectosDeEliminar(a: AporteDiario): { cruces: number; ingresos: number } {
    return { cruces: a.detalles.filter((d) => d.prestamoCruceGeneradoId !== null).length, ingresos: a.detalles.filter((d) => d.transaccionId !== null).length };
  }

  confirmarEliminar(): void {
    const a = this.eliminando;
    if (!a) return;
    this.trabajando = true;
    this.aportesService
      .eliminarAporteDiario(a.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (r: EliminadoAporteDiario) => {
          this.eliminando = null;
          this.toast.exito(`Aporte eliminado${r.crucesAnulados ? ` · ${r.crucesAnulados} cruce(s) anulado(s)` : ''}${r.transaccionesAnuladas ? ` · ${r.transaccionesAnuladas} ingreso(s) revertido(s)` : ''}.`);
          this.cargar();
        },
        error: (err) => {
          this.eliminando = null;
          this.toast.error(mensajeDeError(err, 'No se pudo eliminar el aporte.'));
        }
      });
  }

  // ── periodo (cuota mensual) ──

  abrirPeriodo(): void {
    this.periodoAbierto = true;
    this.modalService.open(this.modalPeriodo);
  }

  onPeriodoGuardado(r: ResultadoGuardarPeriodo): void {
    this.modalService.close();
    this.toast.exito(`${r.creado ? 'Cuota configurada' : 'Cuota actualizada'}: ${nombrePeriodo(r.periodo.periodo)} · ${moneda(r.periodo.valorCuotaObjetivo)}.`);
    this.periodoKpiId = r.periodo.id;
    this.abiertos.add(r.periodo.id);
    this.cargar();
  }

  // ── saldo a favor ──

  abrirExcedente(p: PeriodoCarro | null = null): void {
    this.periodoExcedenteId = p?.id ?? this.periodosConExcedente[0]?.id ?? null;
    this.excedenteAbierto = true;
    this.modalService.open(this.modalExcedente);
  }

  onExcedenteAplicado(r: ResultadoAplicarExcedente): void {
    this.modalService.close();
    this.toast.exito(
      r.destino === 'SIGUIENTE_MES'
        ? `Saldo a favor trasladado a ${nombrePeriodo(r.periodoDestino?.periodo ?? '')}: ${moneda(r.valorAplicado)}.`
        : `Saldo a favor cruzado contra el estado de cuenta de ${this.responsableNombre}: ${moneda(r.valorAplicado)}.`
    );
    this.cargar();
  }

  // ── helpers de plantilla ──

  chipsDeAporte(a: AporteDiario): ChipAporte[] {
    return chipsDeAporte(a);
  }

  nombreDetalle(d: DetalleAporteDiario): string {
    return d.personaNombre ?? `Persona ${d.personaId}`;
  }

  trackPeriodo(_: number, p: PeriodoCarro): number {
    return p.id;
  }

  trackAporte(_: number, a: AporteDiario): number {
    return a.id;
  }

  trackDetalle(_: number, d: DetalleAporteDiario): number {
    return d.id;
  }
}
