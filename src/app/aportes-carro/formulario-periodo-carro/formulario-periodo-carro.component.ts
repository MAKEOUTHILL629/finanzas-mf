import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { GuardarPeriodo, PeriodoCarro, ResultadoGuardarPeriodo } from '../../modelos/aportes';
import { AportesCarroService } from '../../services/aportes-carro.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { nombrePeriodo, periodoActual } from '../../shared/periodo.helper';
import { importeConDosDecimales } from '../../shared/validadores';

/** Cuerpo de `POST /periodos` (el concepto solo se envía si se escribió). */
export function construirPeriodo(v: { periodo: string | null; valorCuota: number | string | null; concepto: string | null }): GuardarPeriodo {
  return {
    periodo: v.periodo as string,
    valorCuota: String(v.valorCuota),
    ...(v.concepto?.trim() ? { concepto: v.concepto.trim() } : {}),
  };
}

@Component({
  selector: 'app-formulario-periodo-carro',
  templateUrl: './formulario-periodo-carro.component.html'
})
export class FormularioPeriodoCarroComponent implements OnInit, OnDestroy {
  @Input({ required: true }) periodos: PeriodoCarro[] = [];
  @Input() cuotaBase: number | null = null;
  @Input() periodoInicial: string | null = null;
  @Output() guardado = new EventEmitter<ResultadoGuardarPeriodo>();
  @Output() cancelar = new EventEmitter<void>();

  readonly nombrePeriodo = nombrePeriodo;
  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group({
    periodo: [periodoActual(), [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)]],
    valorCuota: [null as number | string | null, [Validators.required, importeConDosDecimales]],
    concepto: [''],
  });

  constructor(private aportesService: AportesCarroService) {}

  ngOnInit(): void {
    // Por defecto el mes en curso (si ya existe se edita su cuota); la cuota sugerida es la del periodo más reciente.
    const periodo = this.periodoInicial && this.existente(this.periodoInicial) ? this.periodoInicial : periodoActual();
    this.form.controls.periodo.setValue(periodo);
    this.sugerirCuota();
    this.form.controls.periodo.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.sugerirCuota());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private existente(periodo: string | null): PeriodoCarro | undefined {
    return this.periodos.find((p) => p.periodo === periodo);
  }

  get existe(): PeriodoCarro | undefined {
    return this.existente(this.form.controls.periodo.value);
  }

  private sugerirCuota(): void {
    const actual = this.existe?.valorCuotaObjetivo ?? this.cuotaBase;
    if (!this.form.controls.valorCuota.dirty) this.form.controls.valorCuota.setValue(actual);
  }

  campoInvalido(nombre: 'periodo' | 'valorCuota'): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || c.dirty);
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando = true;
    this.aportesService
      .guardarPeriodo(construirPeriodo(this.form.getRawValue()))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (r) => this.guardado.emit(r),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo guardar la cuota.'))
      });
  }
}
