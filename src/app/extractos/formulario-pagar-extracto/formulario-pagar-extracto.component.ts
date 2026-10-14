import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { CuentaFinanciera, ResultadoPagoExtracto, ResumenMensualTarjeta, Transaccion } from '../../modelos/erp';
import { CuentasFinancierasService } from '../../services/cuentas-financieras.service';
import { TarjetasService } from '../../services/tarjetas.service';
import { TransaccionesService } from '../../services/transacciones.service';
import { esImporteValido, restarMonedas } from '../../shared/dinero.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { nombrePeriodo } from '../../shared/periodo.helper';

function importe(control: { value: unknown }): { importe: true } | null {
  return esImporteValido(control.value) ? null : { importe: true };
}

/**
 * Pago del extracto de una tarjeta. El SP `sp_pagar_extracto_tarjeta` registra el egreso en la cuenta elegida y marca
 * como PAGADA TODAS las cuotas de la tarjeta en ese periodo, y la app no tiene forma de deshacerlo: por eso se pide
 * confirmación explícita y se avisa si ya existe un pago de ese extracto o si la cuenta quedaría en negativo.
 */
@Component({
  selector: 'app-formulario-pagar-extracto',
  templateUrl: './formulario-pagar-extracto.component.html',
  styleUrl: './formulario-pagar-extracto.component.css'
})
export class FormularioPagarExtractoComponent implements OnInit, OnDestroy {
  @Input({ required: true }) resumen!: ResumenMensualTarjeta;
  @Output() pagado = new EventEmitter<ResultadoPagoExtracto>();
  @Output() cancelar = new EventEmitter<void>();

  cuentas: CuentaFinanciera[] = [];
  /** Pagos de este mismo extracto que ya están registrados (no anulados). */
  pagosPrevios: Transaccion[] = [];
  cargando = true;
  enviando = false;
  errorServidor: string | null = null;

  private destroy$ = new Subject<void>();
  private readonly fb = inject(FormBuilder);

  form = this.fb.group({
    cuentaOrigenId: [null as number | null, Validators.required],
    montoPagado: [null as number | null, [Validators.required, importe]],
    confirmo: [false, Validators.requiredTrue],
    confirmoDuplicado: [false],
  });

  constructor(
    private tarjetasService: TarjetasService,
    private cuentasService: CuentasFinancierasService,
    private transaccionesService: TransaccionesService
  ) {}

  ngOnInit(): void {
    this.form.controls.montoPagado.setValue(Number(this.resumen.total_extracto_cop));

    forkJoin({
      cuentas: this.cuentasService.getCuentas(true),
      // Si la consulta de pagos previos falla no se bloquea el pago: solo se pierde el aviso de duplicado.
      transacciones: this.transaccionesService
        .getTransacciones({ tipo: 'PAGO_TARJETA', limit: 200 })
        .pipe(catchError(() => of(null))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: ({ cuentas, transacciones }) => {
          // El SP registra el pago en COP: solo se ofrecen cuentas en pesos.
          this.cuentas = cuentas.filter((c) => c.moneda === 'COP');
          if (this.cuentas.length === 1) this.form.controls.cuentaOrigenId.setValue(this.cuentas[0].id);
          this.pagosPrevios = (transacciones?.items ?? []).filter(
            (t) =>
              t.tarjeta_pagada_id === this.resumen.tarjeta_id &&
              t.estado !== 'ANULADO' &&
              t.concepto.includes(`(${this.resumen.periodo_facturacion})`)
          );
          if (this.pagosPrevios.length > 0) {
            this.form.controls.confirmoDuplicado.addValidators(Validators.requiredTrue);
            this.form.controls.confirmoDuplicado.updateValueAndValidity();
          }
        },
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudieron cargar las cuentas.'))
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get cuentaSeleccionada(): CuentaFinanciera | undefined {
    const id = this.form.controls.cuentaOrigenId.value;
    return this.cuentas.find((c) => c.id === Number(id));
  }

  /** Saldo estimado de la cuenta tras el pago (el definitivo lo calcula el Trigger 2 de la BD). */
  get saldoResultante(): number | null {
    const cuenta = this.cuentaSeleccionada;
    const monto = this.form.controls.montoPagado.value;
    if (!cuenta || !esImporteValido(monto)) return null;
    return restarMonedas(cuenta.saldo_actual, monto);
  }

  get dejaSaldoNegativo(): boolean {
    return (this.saldoResultante ?? 0) < 0;
  }

  get diferenciaConExtracto(): number {
    const monto = this.form.controls.montoPagado.value;
    return esImporteValido(monto) ? restarMonedas(monto, this.resumen.total_extracto_cop) : 0;
  }

  nombrePeriodo(p: string): string {
    return nombrePeriodo(p);
  }

  nombreTarjeta(): string {
    return [this.resumen.franquicia, this.resumen.nombre_tarjeta].filter((x) => !!x).join(' · ') || `Tarjeta #${this.resumen.tarjeta_id}`;
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid || this.cuentas.length === 0) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.enviando = true;
    this.tarjetasService
      .pagarExtracto(this.resumen.tarjeta_id, {
        cuentaOrigenId: Number(v.cuentaOrigenId),
        periodo: this.resumen.periodo_facturacion,
        montoPagado: String(v.montoPagado),
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (res) => this.pagado.emit(res),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo registrar el pago del extracto.'))
      });
  }

  campoInvalido(nombre: 'cuentaOrigenId' | 'montoPagado'): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || c.dirty);
  }
}
