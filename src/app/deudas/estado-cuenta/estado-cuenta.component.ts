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

export const MODAL_ABONO = 'abono-form';

@Component({
  selector: 'app-estado-cuenta',
  templateUrl: './estado-cuenta.component.html',
  styleUrl: './estado-cuenta.component.css'
})
export class EstadoCuentaComponent implements OnInit, OnDestroy {
  readonly modalId = MODAL_ABONO;
  readonly etiquetaMovimiento = etiquetaMovimiento;
  readonly esAbono = esAbono;
  readonly iniciales = iniciales;

  periodo: Periodo = periodoActual();
  filas: EstadoCuentaPersona[] = [];
  totales: TotalesEstadoCuenta = totalesEstadoCuenta([]);
  verTodas = false;

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
          // si la persona seleccionada sigue en la lista, se refresca su extracto
          const sigue = this.seleccionada ? f.find((x) => x.persona_id === this.seleccionada?.persona_id) : undefined;
          this.seleccionada = sigue ?? null;
          if (this.seleccionada) this.cargarExtracto(this.seleccionada);
        },
        error: (err) => {
          this.filas = [];
          this.totales = totalesEstadoCuenta([]);
          this.seleccionada = null;
          this.error = mensajeDeError(err, 'No se pudo cargar el estado de cuenta.');
        }
      });
  }

  get visibles(): EstadoCuentaPersona[] {
    return this.verTodas ? this.filas : this.filas.filter(tieneActividad);
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
