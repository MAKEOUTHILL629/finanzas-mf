import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { CorteCobro, CrearCorteCobro, EstadoCorte } from '../../modelos/cobros';
import { CortesCobroService } from '../../services/cortes-cobro.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { hoyIso } from '../../shared/periodo.helper';
import { fechasCoherentes } from '../../shared/validadores';
import { ESTADOS_CORTE } from '../prestamos.constants';

/** Alta (`corte = null`) o edición de un corte de cobro. El formulario se crea al abrir el modal. */
@Component({
  selector: 'app-formulario-corte',
  templateUrl: './formulario-corte.component.html'
})
export class FormularioCorteComponent implements OnInit, OnDestroy {
  @Input() corte: CorteCobro | null = null;
  @Output() guardado = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  readonly estados = ESTADOS_CORTE;
  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group(
    {
      concepto: ['', [Validators.required, Validators.maxLength(255)]],
      fechaInicio: [hoyIso(), Validators.required],
      fechaFinal: [hoyIso(), Validators.required],
      estado: ['FUTURO' as EstadoCorte, Validators.required],
    },
    { validators: fechasCoherentes('fechaInicio', 'fechaFinal') }
  );

  constructor(private cortesService: CortesCobroService) {}

  get esEdicion(): boolean {
    return !!this.corte;
  }

  ngOnInit(): void {
    if (this.corte) {
      this.form.reset({
        concepto: this.corte.concepto,
        // columnas `date` llegan como `yyyy-MM-ddT00:00:00.000Z`: el día de calendario es el prefijo
        fechaInicio: this.corte.fecha_inicio.slice(0, 10),
        fechaFinal: this.corte.fecha_final.slice(0, 10),
        estado: this.corte.estado ?? 'FUTURO',
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const cuerpo: CrearCorteCobro = {
      concepto: (v.concepto ?? '').trim(),
      fechaInicio: v.fechaInicio as string,
      fechaFinal: v.fechaFinal as string,
      estado: v.estado as EstadoCorte,
    };
    this.enviando = true;
    const peticion = this.corte ? this.cortesService.actualizarCorte(this.corte.id, cuerpo) : this.cortesService.crearCorte(cuerpo);
    peticion
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: () => this.guardado.emit(),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo guardar el corte.'))
      });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
