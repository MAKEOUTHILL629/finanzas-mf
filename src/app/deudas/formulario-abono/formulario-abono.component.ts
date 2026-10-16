import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { CorteCobro } from '../../modelos/cobros';
import { AbonarPersona, EstadoCuentaPersona, Periodo, ResultadoAbonoPersona } from '../../modelos/erp';
import { ItemCuenta } from '../../modelos/catalogos';
import { CatalogosService } from '../../services/catalogos.service';
import { CortesCobroService } from '../../services/cortes-cobro.service';
import { LedgerDeudasService } from '../../services/ledger-deudas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { moneda } from '../../shared/moneda.util';
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

  /** Cuentas activas en pesos (el SP registra el ingreso en COP). */
  cuentas: ItemCuenta[] = [];
  cortes: CorteCobro[] = [];
  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();
  private cuentasListas = false;
  private cortesListos = false;

  readonly soloPesos = (c: ItemCuenta): boolean => c.moneda === 'COP';
  readonly etiquetaConSaldo = (c: ItemCuenta): string => `${c.nombre} — saldo ${moneda(c.saldoActual)}`;

  form = this.fb.group({
    cuentaDestinoId: [null as number | null, Validators.required],
    monto: [null as number | string | null, [Validators.required, importeConDosDecimales]],
    periodoImputacion: ['', [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)]],
    concepto: ['', [Validators.required, Validators.maxLength(255)]],
    corteId: [null as number | null],
  });

  constructor(
    private ledgerService: LedgerDeudasService,
    private catalogos: CatalogosService,
    private cortesService: CortesCobroService
  ) {}

  get cargando(): boolean {
    return !(this.cuentasListas && this.cortesListos);
  }

  ngOnInit(): void {
    const saldo = Number(this.persona.saldo_total_acumulado ?? 0);
    this.form.patchValue({
      periodoImputacion: this.periodo,
      concepto: `Abono de ${this.persona.nombre ?? 'la persona'}`,
      monto: saldo > 0 ? saldo : null,
    });

    this.catalogos.estado$('cuentas').pipe(takeUntil(this.destroy$)).subscribe((e) => {
      if (e.cargado) {
        this.cuentasListas = true;
        this.cuentas = e.datos.filter((c) => c.activa && this.soloPesos(c));
        if (this.cuentas.length === 1 && this.form.controls.cuentaDestinoId.value === null) this.form.controls.cuentaDestinoId.setValue(this.cuentas[0].id);
      } else if (e.error) {
        this.cuentasListas = true;
        this.errorServidor = e.error;
      }
    });
    this.catalogos.asegurar(['cuentas'], { forzar: true }); // el saldo que se muestra debe estar al día

    this.cortesService
      .getCortes()
      .pipe(
        catchError(() => of([] as CorteCobro[])),
        takeUntil(this.destroy$),
        finalize(() => (this.cortesListos = true))
      )
      .subscribe((cortes) => (this.cortes = cortes));
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
