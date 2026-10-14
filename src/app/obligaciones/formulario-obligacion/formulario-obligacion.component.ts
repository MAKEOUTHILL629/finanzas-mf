import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { CrearObligacionMes } from '../../modelos/erp';
import { Persona } from '../../modelos/persona';
import { ObligacionesMesService } from '../../services/obligaciones-mes.service';
import { PersonasService } from '../../services/personas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { fechasCoherentes, importeConDosDecimales } from '../../shared/validadores';
import { finDePeriodo, periodoActual } from '../../shared/periodo.helper';
import { TIPOS_OBLIGACION } from '../obligaciones.constants';

@Component({
  selector: 'app-formulario-obligacion',
  templateUrl: './formulario-obligacion.component.html'
})
export class FormularioObligacionComponent implements OnInit, OnDestroy {
  @Output() creada = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  readonly tipos = TIPOS_OBLIGACION;
  personas: Persona[] = [];
  cargandoPersonas = true;
  enviando = false;
  errorServidor: string | null = null;

  private destroy$ = new Subject<void>();
  private readonly fb = inject(FormBuilder);

  private readonly periodoInicial = periodoActual();

  form = this.fb.group(
    {
      tipoObligacion: ['CUOTA_CARRO', Validators.required],
      concepto: ['', [Validators.required, Validators.maxLength(255)]],
      periodo: [this.periodoInicial, [Validators.required, Validators.pattern(/^\d{4}-(0[1-9]|1[0-2])$/)]],
      responsablePrincipalId: [null as number | null, Validators.required],
      metaMensual: [null as number | null, [Validators.required, importeConDosDecimales]],
      fechaInicio: [`${this.periodoInicial}-01`, Validators.required],
      fechaFinal: [finDePeriodo(this.periodoInicial)],
    },
    { validators: fechasCoherentes('fechaInicio', 'fechaFinal') }
  );

  constructor(
    private obligacionesService: ObligacionesMesService,
    private personasService: PersonasService
  ) {}

  ngOnInit(): void {
    this.personasService
      .getPersonas()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargandoPersonas = false))
      )
      .subscribe({
        next: (p) => (this.personas = p),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudieron cargar las personas.'))
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Al cambiar el periodo, las fechas por defecto lo acompañan (solo si el usuario no las tocó). */
  onPeriodoChange(): void {
    const periodo = this.form.controls.periodo.value;
    if (!periodo || this.form.controls.periodo.invalid) return;
    if (!this.form.controls.fechaInicio.dirty) this.form.controls.fechaInicio.setValue(`${periodo}-01`);
    if (!this.form.controls.fechaFinal.dirty) this.form.controls.fechaFinal.setValue(finDePeriodo(periodo));
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const cuerpo: CrearObligacionMes = {
      tipoObligacion: v.tipoObligacion as CrearObligacionMes['tipoObligacion'],
      responsablePrincipalId: Number(v.responsablePrincipalId),
      concepto: (v.concepto ?? '').trim(),
      periodo: v.periodo as string,
      metaMensual: String(v.metaMensual),
      fechaInicio: v.fechaInicio as string,
      ...(v.fechaFinal ? { fechaFinal: v.fechaFinal } : {}),
    };

    this.enviando = true;
    this.obligacionesService
      .crearObligacion(cuerpo)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: () => {
          this.reiniciar();
          this.creada.emit();
        },
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo crear la obligación.'))
      });
  }

  private reiniciar(): void {
    this.form.reset({
      tipoObligacion: 'CUOTA_CARRO',
      concepto: '',
      periodo: this.periodoInicial,
      responsablePrincipalId: null,
      metaMensual: null,
      fechaInicio: `${this.periodoInicial}-01`,
      fechaFinal: finDePeriodo(this.periodoInicial),
    });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
