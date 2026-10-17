import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AjusteCobro, EnlaceCobro } from '../../modelos/cobros-personas';
import { CobrosPersonasService } from '../../services/cobros-personas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { moneda } from '../../shared/moneda.util';
import { nombrePeriodo } from '../../shared/periodo.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { descuentoDeAccion, saldoTrasDescuento } from '../cobros-fase6.helpers';

/**
 * Descuento directo sobre lo que debe una persona (sin que haya una observación) y lista de los descuentos y ajustes vigentes de su
 * enlace, cada uno con «Deshacer». El total del enlace de la persona se recalcula al confirmar.
 */
@Component({
  selector: 'app-descuento-enlace',
  templateUrl: './descuento-enlace.component.html',
  styleUrl: './descuento-enlace.component.css',
})
export class DescuentoEnlaceComponent implements OnInit, OnDestroy {
  @Input({ required: true }) enlace!: EnlaceCobro;
  /** Se aplicó o se deshizo un descuento: el enlace ya viene recalculado. */
  @Output() cambio = new EventEmitter<EnlaceCobro | void>();
  @Output() cerrar = new EventEmitter<void>();

  readonly nombrePeriodo = nombrePeriodo;
  readonly moneda = moneda;

  monto = '';
  motivo = '';
  intentado = false;
  trabajando = false;
  error: string | null = null;

  ajustes: AjusteCobro[] = [];
  cargandoAjustes = true;
  deshaciendo: number | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private servicio: CobrosPersonasService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.cargarAjustes();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get saldo(): number {
    return this.enlace.resumen?.saldoTotalAcumulado ?? 0;
  }

  get previa(): { descuento: number | null; error: string | null; saldoNuevo: number | null } {
    const r = descuentoDeAccion('DESCUENTO', null, this.monto, this.saldo);
    return { ...r, saldoNuevo: r.descuento === null ? null : saldoTrasDescuento(this.saldo, r.descuento) };
  }

  get motivoInvalido(): boolean {
    return this.motivo.trim().length < 3;
  }

  get puedeAplicar(): boolean {
    return this.saldo > 0 && this.previa.descuento !== null && !this.previa.error && !this.motivoInvalido && !this.trabajando;
  }

  descontarTodo(): void {
    this.monto = String(this.saldo);
  }

  private cargarAjustes(): void {
    this.cargandoAjustes = true;
    this.servicio
      .getAjustes(this.enlace.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargandoAjustes = false))
      )
      .subscribe({ next: (l) => (this.ajustes = l), error: () => (this.ajustes = []) });
  }

  aplicar(): void {
    this.intentado = true;
    this.error = null;
    if (!this.puedeAplicar) return;
    this.trabajando = true;
    this.servicio
      .descuentoDirecto(this.enlace.id, { monto: this.monto, motivo: this.motivo.trim() })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (r) => {
          this.enlace = r.enlace;
          this.monto = '';
          this.motivo = '';
          this.intentado = false;
          this.toast.exito(`Descuento aplicado: ${this.enlace.persona ?? 'la persona'} ahora debe ${moneda(r.enlace.resumen?.saldoTotalAcumulado ?? 0)}.`);
          this.cargarAjustes();
          this.cambio.emit(r.enlace);
        },
        error: (err) => (this.error = mensajeDeError(err, 'No se pudo aplicar el descuento.')),
      });
  }

  deshacer(a: AjusteCobro): void {
    if (this.deshaciendo !== null) return;
    this.deshaciendo = a.movimientoId;
    this.servicio
      .deshacerAjuste(a.movimientoId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.deshaciendo = null))
      )
      .subscribe({
        next: () => {
          this.toast.exito('Ajuste deshecho: la persona vuelve a deber ese monto.');
          this.cargarAjustes();
          this.cambio.emit();
        },
        error: (err) => this.toast.error(mensajeDeError(err, 'No se pudo deshacer el ajuste.')),
      });
  }

  trackById(_: number, a: AjusteCobro): number {
    return a.movimientoId;
  }
}
