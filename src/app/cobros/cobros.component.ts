import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { CobroPuntual, EnlaceCobro, EstadoReporte, IngresoSugerido, ReportePago, ResultadoAprobacion } from '../modelos/cobros-personas';
import { CuentaFinanciera } from '../modelos/erp';
import { Persona } from '../modelos/persona';
import { CobrosPersonasService } from '../services/cobros-personas.service';
import { CuentasFinancierasService } from '../services/cuentas-financieras.service';
import { ModalService } from '../services/modal.service';
import { PersonasService } from '../services/personas.service';
import { mensajeDeError } from '../shared/http-error.helper';
import { moneda } from '../shared/moneda.util';
import { copiarAlPortapapeles } from '../shared/portapapeles.helper';
import { desplazarPeriodo, esPeriodoValido, nombrePeriodo, periodoActual } from '../shared/periodo.helper';
import { ToastService } from '../shared/toast/toast.service';
import { tamanoLegible } from '../shared/archivo.helper';
import {
  claseEstadoReporte,
  enlaceWhatsApp,
  etiquetaCategoria,
  etiquetaEstadoReporte,
  etiquetaMedio,
  iconoCategoria,
  telefonoWhatsApp,
  textoParaCompartir,
  urlPublica,
  vencimientoLegible,
} from './cobros.constants';

export type PestanaCobros = 'gastos' | 'reportes' | 'ingresos' | 'enlaces';
export const MODAL_COBRO = 'cobro-form';
export const MODAL_APROBAR = 'cobro-aprobar';
export const MODAL_COMPARTIR_COBRO = 'cobro-compartir';

/** Pagos reportados: los pendientes primero (más antiguos antes), luego lo ya revisado (más reciente primero). */
export function ordenarReportes(reportes: ReportePago[]): ReportePago[] {
  const peso = (e: EstadoReporte) => (e === 'PENDIENTE' ? 0 : 1);
  return [...reportes].sort((a, b) => {
    if (peso(a.estado) !== peso(b.estado)) return peso(a.estado) - peso(b.estado);
    const ta = new Date(a.creadoEn ?? 0).getTime();
    const tb = new Date(b.creadoEn ?? 0).getTime();
    return a.estado === 'PENDIENTE' ? ta - tb : tb - ta;
  });
}

@Component({
  selector: 'app-cobros',
  templateUrl: './cobros.component.html',
  styleUrl: './cobros.component.css'
})
export class CobrosComponent implements OnInit, OnDestroy {
  readonly modalCobro = MODAL_COBRO;
  readonly modalAprobar = MODAL_APROBAR;
  readonly modalCompartir = MODAL_COMPARTIR_COBRO;

  readonly nombrePeriodo = nombrePeriodo;
  readonly categoria = etiquetaCategoria;
  readonly iconoCat = iconoCategoria;
  readonly medio = etiquetaMedio;
  readonly estadoReporte = etiquetaEstadoReporte;
  readonly claseReporte = claseEstadoReporte;
  readonly vence = vencimientoLegible;
  readonly tamano = tamanoLegible;

  periodo = periodoActual();
  pestana: PestanaCobros = 'gastos';
  cobros: CobroPuntual[] = [];
  reportes: ReportePago[] = [];
  ingresos: IngresoSugerido[] = [];
  enlaces: EnlaceCobro[] = [];
  personas: Persona[] = [];
  cuentas: CuentaFinanciera[] = [];
  cargando = true;
  /** Qué listas no se pudieron cargar (las demás se muestran igual). */
  errores: string[] = [];

  // modales / acciones
  editando: CobroPuntual | null = null;
  formularioAbierto = false;
  aprobando: ReportePago | null = null;
  compartiendo: { personaId: number; nombre: string | null; celular: string | null } | null = null;
  confirmandoAnular: CobroPuntual | null = null;
  rechazando: ReportePago | null = null;
  motivoRechazo = '';
  trabajando = false;
  verComprobanteId: number | null = null;
  filtroReportes: '' | EstadoReporte = 'PENDIENTE';

  private destroy$ = new Subject<void>();

  constructor(
    private cobrosService: CobrosPersonasService,
    private personasService: PersonasService,
    private cuentasService: CuentasFinancierasService,
    private modalService: ModalService,
    private toast: ToastService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'gastos' || tab === 'reportes' || tab === 'ingresos' || tab === 'enlaces') this.pestana = tab;
    const periodo = this.route.snapshot.queryParamMap.get('periodo');
    if (esPeriodoValido(periodo)) this.periodo = periodo;

    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalCobro) this.formularioAbierto = false;
      if (id !== this.modalAprobar) this.aprobando = null;
      if (id !== this.modalCompartir) this.compartiendo = null;
    });
    this.personasService.getPersonas().pipe(takeUntil(this.destroy$), catchError(() => of([] as Persona[]))).subscribe((p) => (this.personas = p));
    this.cuentasService.getCuentas(true).pipe(takeUntil(this.destroy$), catchError(() => of([] as CuentaFinanciera[]))).subscribe((c) => (this.cuentas = c));
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── carga ──

  cargar(): void {
    this.cargando = true;
    this.errores = [];
    const seguro = <T>(obs: Observable<T>, vacio: T, que: string): Observable<T> =>
      obs.pipe(
        catchError((err) => {
          const detalle = mensajeDeError(err, '');
          this.errores.push(`No se pudo cargar ${que}.${detalle ? ' ' + detalle : ''}`);
          return of(vacio);
        })
      );
    forkJoin({
      cobros: seguro(this.cobrosService.getCobros({ periodo: this.periodo }), [] as CobroPuntual[], 'los gastos repartidos'),
      reportes: seguro(this.cobrosService.getReportes(), [] as ReportePago[], 'los pagos reportados'),
      ingresos: seguro(this.cobrosService.getIngresosSugeridos(this.periodo), [] as IngresoSugerido[], 'los ingresos por aplicar'),
      enlaces: seguro(this.cobrosService.getEnlaces(this.periodo), [] as EnlaceCobro[], 'los enlaces'),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe((r) => {
        this.cobros = r.cobros;
        this.reportes = ordenarReportes(r.reportes);
        this.ingresos = r.ingresos;
        this.enlaces = r.enlaces;
      });
  }

  // ── periodo ──

  onPeriodoChange(valor: string): void {
    if (!esPeriodoValido(valor)) return;
    this.periodo = valor;
    this.cargar();
  }

  moverPeriodo(delta: number): void {
    this.periodo = desplazarPeriodo(this.periodo, delta);
    this.cargar();
  }

  // ── listas derivadas ──

  get pendientes(): number {
    return this.reportes.filter((r) => r.estado === 'PENDIENTE').length;
  }

  get reportesVisibles(): ReportePago[] {
    return this.filtroReportes ? this.reportes.filter((r) => r.estado === this.filtroReportes) : this.reportes;
  }

  get totalACobrar(): number {
    return this.cobros.reduce((a, c) => a + c.montoACobrar, 0);
  }

  // ── gastos repartidos ──

  abrirNuevo(): void {
    this.editando = null;
    this.formularioAbierto = true;
    this.modalService.open(this.modalCobro);
  }

  abrirEditar(c: CobroPuntual): void {
    this.editando = c;
    this.formularioAbierto = true;
    this.modalService.open(this.modalCobro);
  }

  cerrarModal(): void {
    this.modalService.close();
  }

  onCobroGuardado(c: CobroPuntual): void {
    this.modalService.close();
    this.toast.exito(`Gasto repartido: se te debe ${moneda(c.montoACobrar)}.`);
    this.cargar();
  }

  pedirAnular(c: CobroPuntual): void {
    this.confirmandoAnular = c;
  }

  confirmarAnular(): void {
    const c = this.confirmandoAnular;
    if (!c) return;
    this.trabajando = true;
    this.cobrosService
      .anularCobro(c.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.confirmandoAnular = null;
          this.toast.exito('Gasto anulado: ya no cuenta en la liquidación.');
          this.cargar();
        },
        error: (err) => {
          this.confirmandoAnular = null;
          this.toast.error(mensajeDeError(err, 'No se pudo anular el gasto.'));
        }
      });
  }

  // ── pagos reportados ──

  verComprobante(r: ReportePago): void {
    this.verComprobanteId = r.id;
    this.cobrosService
      .getComprobante(r.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.verComprobanteId = null))
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank', 'noopener');
          setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo abrir el comprobante.'))
      });
  }

  abrirAprobar(r: ReportePago): void {
    this.aprobando = r;
    this.modalService.open(this.modalAprobar);
  }

  onAprobado(res: ResultadoAprobacion): void {
    this.modalService.close();
    this.toast.exito(`Pago aprobado: ${moneda(res.monto)} abonados.`);
    this.cargar();
  }

  pedirRechazo(r: ReportePago): void {
    this.rechazando = r;
    this.motivoRechazo = '';
  }

  cancelarRechazo(): void {
    this.rechazando = null;
  }

  confirmarRechazo(): void {
    const r = this.rechazando;
    const motivo = this.motivoRechazo.trim();
    if (!r || motivo.length < 2) return;
    this.trabajando = true;
    this.cobrosService
      .rechazarReporte(r.id, motivo)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.rechazando = null;
          this.toast.exito('Pago rechazado: la persona verá el motivo.');
          this.cargar();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo rechazar el pago.'))
      });
  }

  // ── ingresos que ya llegaron ──

  aplicarIngreso(i: IngresoSugerido): void {
    this.trabajando = true;
    this.cobrosService
      .aplicarIngreso({ transaccionId: i.transaccionId, personaId: i.personaId, periodo: this.periodo })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (r) => {
          this.toast.exito(`${moneda(r.monto)} de ${i.persona ?? 'la persona'} abonados a ${nombrePeriodo(this.periodo)}.`);
          this.cargar();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo aplicar el ingreso.'))
      });
  }

  // ── enlaces ──

  urlDe(e: EnlaceCobro): string {
    return urlPublica(e.token, window.location.origin);
  }

  async copiar(e: EnlaceCobro): Promise<void> {
    const ok = await copiarAlPortapapeles(this.urlDe(e));
    if (ok) this.toast.exito('Enlace copiado.');
    else this.toast.info(this.urlDe(e));
  }

  whatsapp(e: EnlaceCobro): string {
    const p = this.personas.find((x) => x.id === e.personaId);
    return enlaceWhatsApp(telefonoWhatsApp(p?.numeroCelular), textoParaCompartir(e.persona, e.periodo, this.urlDe(e), e.resumen?.saldoTotalAcumulado));
  }

  abrirCompartir(e: EnlaceCobro): void {
    const p = this.personas.find((x) => x.id === e.personaId);
    this.compartiendo = { personaId: e.personaId, nombre: e.persona, celular: p?.numeroCelular ?? null };
    this.modalService.open(this.modalCompartir);
  }

  onEnlaceCambiado(): void {
    this.cargar();
  }

  refrescarEnlace(e: EnlaceCobro): void {
    this.trabajando = true;
    this.cobrosService
      .refrescarEnlace(e.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.toast.exito('Enlace actualizado con la liquidación de hoy.');
          this.cargar();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo actualizar el enlace.'))
      });
  }

  revocarEnlace(e: EnlaceCobro): void {
    this.trabajando = true;
    this.cobrosService
      .revocarEnlace(e.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: () => {
          this.toast.exito('Enlace desactivado.');
          this.cargar();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo desactivar el enlace.'))
      });
  }

  trackById(_: number, x: { id: number }): number {
    return x.id;
  }
}
