import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ModalidadDuracion, NaturalezaRecurrentePersona, RecurrentePersona } from '../../modelos/aportes';
import { Persona } from '../../modelos/persona';
import { RecurrentesPersonaService } from '../../services/recurrentes-persona.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { nombrePeriodo, periodoActual } from '../../shared/periodo.helper';
import { importeConDosDecimales } from '../../shared/validadores';
import { cambiosDeRecurrente, construirRecurrente, mesFinPrevisto } from '../recurrentes-persona.constants';

/** Con plazo fijo el número de meses es obligatorio (entero 1–600); de por vida no lleva plazo. */
export function plazoCoherente(g: AbstractControl): ValidationErrors | null {
  const modalidad = g.get('modalidadDuracion')?.value as ModalidadDuracion | null;
  const meses = g.get('numeroMeses')?.value;
  if (modalidad !== 'PLAZO_FIJO') return null;
  const n = Number(meses);
  return meses !== null && meses !== '' && Number.isInteger(n) && n >= 1 && n <= 600 ? null : { plazoInvalido: true };
}

@Component({
  selector: 'app-formulario-recurrente-persona',
  templateUrl: './formulario-recurrente-persona.component.html'
})
export class FormularioRecurrentePersonaComponent implements OnInit, OnDestroy {
  @Input() personas: Persona[] = [];
  /** Recurrente a editar; `null` = alta. */
  @Input() recurrente: RecurrentePersona | null = null;
  @Output() guardado = new EventEmitter<RecurrentePersona>();
  @Output() cancelar = new EventEmitter<void>();

  readonly nombrePeriodo = nombrePeriodo;
  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group(
    {
      personaId: [null as number | null, Validators.required],
      concepto: ['', [Validators.required, Validators.maxLength(200)]],
      valorMensual: [null as number | string | null, [Validators.required, importeConDosDecimales]],
      naturaleza: ['CARGO_A_COBRAR' as NaturalezaRecurrentePersona | null, Validators.required],
      modalidadDuracion: ['INDEFINIDO' as ModalidadDuracion | null, Validators.required],
      numeroMeses: [null as number | string | null],
      mesInicio: [periodoActual(), [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)]],
      diaCobro: [1 as number | string | null, [Validators.min(1), Validators.max(31)]],
      notas: [''],
    },
    { validators: plazoCoherente }
  );

  get editando(): boolean {
    return !!this.recurrente;
  }

  /** Con cuotas ya generadas, el mes de inicio y la naturaleza quedan fijos (están en el estado de cuenta). */
  get bloqueado(): boolean {
    return !!this.recurrente && this.recurrente.cuotasGeneradas > 0;
  }

  ngOnInit(): void {
    const r = this.recurrente;
    if (r) {
      this.form.patchValue({
        personaId: r.personaId,
        concepto: r.concepto,
        valorMensual: r.valorMensual,
        naturaleza: r.naturaleza,
        modalidadDuracion: r.modalidadDuracion,
        numeroMeses: r.numeroMeses,
        mesInicio: r.mesInicio,
        diaCobro: r.diaCobro,
        notas: r.notas ?? '',
      });
      this.form.controls.personaId.disable();
      if (this.bloqueado) {
        this.form.controls.mesInicio.disable();
        this.form.controls.naturaleza.disable();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get plazoFijo(): boolean {
    return this.form.controls.modalidadDuracion.value === 'PLAZO_FIJO';
  }

  /** «Terminará en Marzo 2027» mientras se escribe el plazo. */
  get mesFin(): string | null {
    return this.plazoFijo ? mesFinPrevisto(this.form.controls.mesInicio.value, this.form.controls.numeroMeses.value) : null;
  }

  campoInvalido(nombre: 'personaId' | 'concepto' | 'valorMensual' | 'mesInicio' | 'diaCobro'): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || c.dirty);
  }

  get plazoInvalido(): boolean {
    return this.form.hasError('plazoInvalido') && (this.form.controls.numeroMeses.touched || this.form.controls.numeroMeses.dirty);
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valores = this.form.getRawValue();
    this.enviando = true;
    const peticion = this.recurrente
      ? this.recurrentesService.actualizar(this.recurrente.id, cambiosDeRecurrente(this.recurrente, valores))
      : this.recurrentesService.crear(construirRecurrente(valores));
    peticion
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (r) => this.guardado.emit(r),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo guardar el recurrente.'))
      });
  }

  constructor(private recurrentesService: RecurrentesPersonaService) {}
}
