import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { EstadoCuentaPersona, MovimientoExtracto, Periodo, ResultadoAbonoPersona } from '../../modelos/erp';
import { LedgerDeudasService } from '../../services/ledger-deudas.service';
import { ModalService } from '../../services/modal.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { moneda } from '../../shared/moneda.util';
import { desplazarPeriodo, esPeriodoValido, nombrePeriodo, periodoActual } from '../../shared/periodo.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { TotalesEstadoCuenta, esAbono, etiquetaMovimiento, iniciales, tieneActividad, totalesEstadoCuenta } from '../deudas.constants';
import { ACCION_MES_ACTUAL, AccionUI, ListaAcciones } from '../../shared/ui/acciones/acciones.component';
import { ColumnaTabla } from '../../shared/ui/apple-table/apple-table.types';

export const MODAL_ABONO = 'abono-form';

@Component({
  selector: 'app-estado-cuenta',
  templateUrl: './estado-cuenta.component.html',
  styleUrl: './estado-cuenta.component.css'
})
export class EstadoCuentaComponent implements OnInit, OnDestroy {
  private readonly accSecundarias = new ListaAcciones();
  get secundarias(): AccionUI[] {
    return this.accSecundarias.obtener(String(this.esMesActual()), () => [
      { id: 'cruces', etiqueta: 'Cruces de deuda', icono: 'swap_horiz', enlace: '/cruces-deuda', tooltip: 'Ver los cruces de cuentas entre personas' },
      ...(this.esMesActual() ? [] : [ACCION_MES_ACTUAL]),
    ]);
  }

  alAccionar(id: string): void {
    if (id === 'mes-actual') this.irAlMesActual();
  }

  readonly modalId = MODAL_ABONO;
  readonly etiquetaMovimiento = etiquetaMovimiento;
  readonly esAbono = esAbono;
  readonly iniciales = iniciales;

  periodo: Periodo = periodoActual();
  filas: EstadoCuentaPersona[] = [];
  totales: TotalesEstadoCuenta = totalesEstadoCuenta([]);
  /** Mostrar también a quien no tuvo actividad en el mes. */
  private _verTodas = false;
  get verTodas(): boolean {
    return this._verTodas;
  }
  set verTodas(v: boolean) {
    this._verTodas = v;
    this.recalcular();
  }
  /** Lo que se ve en la tabla según `verTodas`. */
  visibles: EstadoCuentaPersona[] = [];

  readonly columnas: ColumnaTabla<EstadoCuentaPersona>[] = [
    { id: 'persona', titulo: 'Persona', valor: (f) => f.nombre, prioridad: 1, anchoMin: 160 },
    { id: 'cuotasTc', titulo: 'Cuotas TC', valor: (f) => f.cuotas_tc_mes, formato: 'moneda', prioridad: 2, anchoMin: 110 },
    { id: 'recurrentes', titulo: 'Recurrentes', valor: (f) => f.recurrentes_compartidos_mes, formato: 'moneda', prioridad: 2, anchoMin: 120 },
    { id: 'prestamos', titulo: 'Préstamos', valor: (f) => f.prestamos_mes, formato: 'moneda', prioridad: 2, anchoMin: 110 },
    { id: 'cruces', titulo: 'Cruces', valor: (f) => f.cruces_asumidos_mes, formato: 'moneda', prioridad: 3, anchoMin: 100 },
    { id: 'abonos', titulo: 'Abonos', valor: (f) => f.abonos_recibidos_mes, formato: 'moneda', prioridad: 2, anchoMin: 100 },
    { id: 'neto', titulo: 'Neto del mes', valor: (f) => f.saldo_neto_mes, formato: 'moneda', prioridad: 1, anchoMin: 120 },
    { id: 'saldo', titulo: 'Saldo acumulado', valor: (f) => f.saldo_total_acumulado, formato: 'moneda', prioridad: 1, anchoMin: 130 },
  ];

  /** Totales al pie de la tabla (null si no hay filas). */
  pie: Record<string, string> | null = null;

  /** La fila de la persona seleccionada se resalta. */
  readonly claseFila = (f: EstadoCuentaPersona): string => (this.seleccionada?.persona_id === f.persona_id ? 'apt-fila--activa' : '');

  /** Persona cuyo extracto se muestra. */
  seleccionada: EstadoCuentaPersona | null = null;
  extracto: MovimientoExtracto[] = [];
  cargandoExtracto = false;
  errorExtracto: string | null = null;

  /** Persona a la que se registra un abono (el formulario existe solo mientras el modal está abierto). */
  abonando: EstadoCuentaPersona | null = null;

  cargando = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private ledgerService: LedgerDeudasService,
    private modalService: ModalService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.modalService.modalState$.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      if (id !== this.modalId) this.abonando = null;
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
    this.ledgerService
      .getEstadoCuenta(this.periodo)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (f) => {
          this.filas = f;
          this.totales = totalesEstadoCuenta(f);
          this.recalcular();
          // si la persona seleccionada sigue en la lista, se refresca su extracto
          const sigue = this.seleccionada ? f.find((x) => x.persona_id === this.seleccionada?.persona_id) : undefined;
          this.seleccionada = sigue ?? null;
          if (this.seleccionada) this.cargarExtracto(this.seleccionada);
        },
        error: (err) => {
          this.filas = [];
          this.totales = totalesEstadoCuenta([]);
          this.recalcular();
          this.seleccionada = null;
          this.error = mensajeDeError(err, 'No se pudo cargar el estado de cuenta.');
        }
      });
  }

  private recalcular(): void {
    this.visibles = this._verTodas ? this.filas : this.filas.filter(tieneActividad);
    const t = this.totales;
    this.pie = this.visibles.length === 0 ? null : { persona: 'Total', cuotasTc: moneda(t.cuotasTc), recurrentes: moneda(t.recurrentes), prestamos: moneda(t.prestamos), cruces: moneda(t.cruces), abonos: moneda(t.abonos), neto: moneda(t.netoMes), saldo: moneda(t.saldoAcumulado) };
  }

  get ocultas(): number {
    return this.filas.length - this.filas.filter(tieneActividad).length;
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

  irAlMesActual(): void {
    this.periodo = periodoActual();
    this.cargar();
  }

  esMesActual(): boolean {
    return this.periodo === periodoActual();
  }

  nombrePeriodo(p: string): string {
    return nombrePeriodo(p);
  }

  // ── extracto de una persona ──

  seleccionar(f: EstadoCuentaPersona): void {
    if (this.seleccionada?.persona_id === f.persona_id) {
      this.seleccionada = null;
      return;
    }
    this.seleccionada = f;
    this.cargarExtracto(f);
  }

  private cargarExtracto(f: EstadoCuentaPersona): void {
    this.cargandoExtracto = true;
    this.errorExtracto = null;
    this.extracto = [];
    this.ledgerService
      .getExtracto(f.persona_id, this.periodo)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargandoExtracto = false))
      )
      .subscribe({
        next: (m) => (this.extracto = m),
        error: (err) => (this.errorExtracto = mensajeDeError(err, 'No se pudo cargar el extracto.'))
      });
  }

  // ── abonos ──

  abrirAbono(f: EstadoCuentaPersona): void {
    this.abonando = f;
    this.modalService.open(this.modalId);
  }

  cerrarAbono(): void {
    this.modalService.close();
  }

  onAbonado(r: ResultadoAbonoPersona): void {
    this.modalService.close();
    this.toast.exito(`Abono registrado: ${moneda(r.monto)} (movimiento #${r.movimientoId}).`);
    this.cargar();
  }

  nombreTipo(m: MovimientoExtracto): string {
    return etiquetaMovimiento(m.tipo_movimiento);
  }

  trackById(_: number, f: EstadoCuentaPersona): number {
    return f.persona_id;
  }

  trackByMovimiento(_: number, m: MovimientoExtracto): number {
    return m.id;
  }
}
