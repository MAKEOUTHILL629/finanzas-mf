import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { CorteCobro } from '../../modelos/cobros';
import { AbonarPersona, CuentaFinanciera, EstadoCuentaPersona, Periodo, ResultadoAbonoPersona } from '../../modelos/erp';
import { CortesCobroService } from '../../services/cortes-cobro.service';
import { CuentasFinancierasService } from '../../services/cuentas-financieras.service';
import { LedgerDeudasService } from '../../services/ledger-deudas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { importeConDosDecimales } from '../../shared/validadores';

/** Cuerpo de `POST /personas/:id/abonar`. El corte solo se envía si se eligió (liquida los préstamos de ese corte). */
export function construirAbono(v: {
  cuentaDestinoId: number | null;
  monto: number | string | null;
  periodoImputacion: string | null;
  concepto: string | null;
  corteId: number | null;
}): AbonarPersona {
  return {
    cuentaDestinoId: Number(v.cuentaDestinoId),
    monto: String(v.monto),
    periodoImputacion: v.periodoImputacion as string,
    concepto: (v.concepto ?? '').trim(),
    ...(v.corteId !== null && v.corteId !== undefined ? { liquidarPrestamosCorteId: Number(v.corteId) } : {}),
  };
}

@Component({
  selector: 'app-formulario-abono',
  templateUrl: './formulario-abono.component.html'
})
export class FormularioAbonoComponent implements OnInit, OnDestroy {
  @Input({ required: true }) persona!: EstadoCuentaPersona;
  @Input({ required: true }) periodo!: Periodo;
  @Output() abonado = new EventEmitter<ResultadoAbonoPersona>();
  @Output() cancelar = new EventEmitter<void>();

  cuentas: CuentaFinanciera[] = [];
  cortes: CorteCobro[] = [];
  cargando = true;
  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group({
    cuentaDestinoId: [null as number | null, Validators.required],
    monto: [null as number | string | null, [Validators.required, importeConDosDecimales]],
    periodoImputacion: ['', [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)]],
    concepto: ['', [Validators.required, Validators.maxLength(255)]],
    corteId: [null as number | null],
  });

  constructor(
    private ledgerService: LedgerDeudasService,
    private cuentasService: CuentasFinancierasService,
    private cortesService: CortesCobroService
  ) {}

  ngOnInit(): void {
    const saldo = Number(this.persona.saldo_total_acumulado ?? 0);
    this.form.patchValue({
      periodoImputacion: this.periodo,
      concepto: `Abono de ${this.persona.nombre ?? 'la persona'}`,
      monto: saldo > 0 ? saldo : null,
    });

    forkJoin({
      cuentas: this.cuentasService.getCuentas(true),
      cortes: this.cortesService.getCortes().pipe(catchError(() => of([] as CorteCobro[]))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: ({ cuentas, cortes }) => {
          // el SP registra el ingreso en pesos: solo se ofrecen cuentas COP
          this.cuentas = cuentas.filter((c) => c.moneda === 'COP');
          this.cortes = cortes;
          if (this.cuentas.length === 1) this.form.controls.cuentaDestinoId.setValue(this.cuentas[0].id);
        },
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudieron cargar las cuentas.'))
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid || this.cuentas.length === 0) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando = true;
    this.ledgerService
      .abonarPersona(this.persona.persona_id, construirAbono(this.form.getRawValue()))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (r) => this.abonado.emit(r),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo registrar el abono.'))
      });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
