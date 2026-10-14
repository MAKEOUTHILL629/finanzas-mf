import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AplicarExcedente, DestinoExcedente, PeriodoCarro, ResultadoAplicarExcedente } from '../../modelos/aportes';
import { AportesCarroService } from '../../services/aportes-carro.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { desplazarPeriodo, nombrePeriodo, periodoActual } from '../../shared/periodo.helper';
import { importeConDosDecimales } from '../../shared/validadores';

/** Cuerpo de `POST /periodos/:id/aplicar-excedente`: el periodo de imputación solo aplica al cruce con el estado de cuenta. */
export function construirExcedente(v: { destino: DestinoExcedente | null; valor: number | string | null; periodoImputacion: string | null }): AplicarExcedente {
  return {
    destino: v.destino as DestinoExcedente,
    valor: String(v.valor),
    ...(v.destino === 'ESTADO_CUENTA' && v.periodoImputacion ? { periodoImputacion: v.periodoImputacion } : {}),
  };
}

@Component({
  selector: 'app-formulario-excedente',
  templateUrl: './formulario-excedente.component.html'
})
export class FormularioExcedenteComponent implements OnInit, OnDestroy {
  /** Meses con saldo a favor disponible. */
  @Input({ required: true }) periodos: PeriodoCarro[] = [];
  @Input() periodoInicialId: number | null = null;
  @Input() responsableNombre = 'el responsable';
  @Output() aplicado = new EventEmitter<ResultadoAplicarExcedente>();
  @Output() cancelar = new EventEmitter<void>();

  readonly nombrePeriodo = nombrePeriodo;
  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group({
    periodoId: [null as number | null, Validators.required],
    destino: ['SIGUIENTE_MES' as DestinoExcedente | null, Validators.required],
    valor: [null as number | string | null, [Validators.required, importeConDosDecimales]],
    periodoImputacion: [periodoActual(), Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)],
  });

  constructor(private aportesService: AportesCarroService) {}

  ngOnInit(): void {
    const inicial = this.periodos.find((p) => p.id === this.periodoInicialId) ?? this.periodos[0];
    this.form.controls.periodoId.setValue(inicial?.id ?? null);
    this.sugerirValor();
    this.form.controls.periodoId.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.form.controls.valor.markAsPristine();
      this.sugerirValor();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get periodo(): PeriodoCarro | null {
    return this.periodos.find((p) => p.id === this.form.controls.periodoId.value) ?? null;
  }

  get siguiente(): string | null {
    return this.periodo ? desplazarPeriodo(this.periodo.periodo, 1) : null;
  }

  get destino(): DestinoExcedente | null {
    return this.form.controls.destino.value;
  }

  /** Por defecto se aplica todo el saldo disponible del mes elegido. */
  private sugerirValor(): void {
    if (!this.form.controls.valor.dirty) this.form.controls.valor.setValue(this.periodo?.saldoAFavorDisponible ?? null);
  }

  get excede(): boolean {
    const valor = Number(this.form.controls.valor.value);
    return !!this.periodo && Number.isFinite(valor) && valor > this.periodo.saldoAFavorDisponible;
  }

  campoInvalido(nombre: 'periodoId' | 'valor'): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || c.dirty);
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid || this.excede || !this.periodo) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando = true;
    this.aportesService
      .aplicarExcedente(this.periodo.id, construirExcedente(this.form.getRawValue()))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (r) => this.aplicado.emit(r),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo aplicar el saldo a favor.'))
      });
  }
}
