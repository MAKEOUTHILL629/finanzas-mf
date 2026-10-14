import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { PrestamoDetalle } from '../../modelos/cobros';
import { CrearCruceDeuda } from '../../modelos/erp';
import { Persona } from '../../modelos/persona';
import { LedgerDeudasService } from '../../services/ledger-deudas.service';
import { PrestamosService } from '../../services/prestamos.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { hoyIso } from '../../shared/periodo.helper';
import { importeConDosDecimales } from '../../shared/validadores';
import { estaPendiente, saldoDe } from '../../prestamos/prestamos.constants';

/** El que abona y el que asume la deuda deben ser personas distintas. */
export function personasDistintas(g: AbstractControl): ValidationErrors | null {
  const a = g.get('personaQueAbonaId')?.value;
  const b = g.get('personaQueAsumeDeudaId')?.value;
  return a !== null && a !== undefined && a === b ? { mismaPersona: true } : null;
}

@Component({
  selector: 'app-formulario-cruce',
  templateUrl: './formulario-cruce.component.html'
})
export class FormularioCruceComponent implements OnInit, OnDestroy {
  @Input() personas: Persona[] = [];
  @Output() creado = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  /** Préstamos pendientes (para elegir a cuál se aplica el cruce; opcional). */
  prestamos: PrestamoDetalle[] = [];
  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group(
    {
      fechaCruce: [hoyIso(), Validators.required],
      personaQueAbonaId: [null as number | null, Validators.required],
      personaQueAsumeDeudaId: [null as number | null, Validators.required],
      monto: [null as number | string | null, [Validators.required, importeConDosDecimales]],
      concepto: ['', [Validators.required, Validators.maxLength(255)]],
      prestamoDestinoId: [null as number | null],
      comentarios: [''],
    },
    { validators: personasDistintas }
  );

  constructor(
    private ledgerService: LedgerDeudasService,
    private prestamosService: PrestamosService
  ) {}

  ngOnInit(): void {
    // opcional: si falla, el cruce se puede registrar igual sin vincularlo a un préstamo
    this.prestamosService
      .getPrestamos({ estado: 'Pendiente' })
      .pipe(
        catchError(() => of([] as PrestamoDetalle[])),
        takeUntil(this.destroy$)
      )
      .subscribe((p) => (this.prestamos = p.filter((x) => estaPendiente(x))));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Préstamos pendientes de la persona que asume la deuda. */
  get prestamosDeLaPersona(): PrestamoDetalle[] {
    const id = this.form.controls.personaQueAsumeDeudaId.value;
    return id === null ? [] : this.prestamos.filter((p) => p.responsable === Number(id));
  }

  etiquetaPrestamo(p: PrestamoDetalle): string {
    return `#${p.id} · ${p.concepto} (saldo ${saldoDe(p)})`;
  }

  construirCuerpo(): CrearCruceDeuda {
    const v = this.form.getRawValue();
    const comentarios = (v.comentarios ?? '').trim();
    return {
      fechaCruce: v.fechaCruce as string,
      personaQueAbonaId: Number(v.personaQueAbonaId),
      personaQueAsumeDeudaId: Number(v.personaQueAsumeDeudaId),
      monto: String(v.monto),
      concepto: (v.concepto ?? '').trim(),
      ...(v.prestamoDestinoId !== null && v.prestamoDestinoId !== undefined ? { prestamoDestinoId: Number(v.prestamoDestinoId) } : {}),
      ...(comentarios ? { comentarios } : {}),
    };
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando = true;
    this.ledgerService
      .crearCruceDeuda(this.construirCuerpo())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: () => this.creado.emit(),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo registrar el cruce.'))
      });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
