import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { CorteCobro, CrearPrestamo, MetodoPrestamo } from '../../modelos/cobros';
import { CortesCobroService } from '../../services/cortes-cobro.service';
import { PrestamosService } from '../../services/prestamos.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { hoyIso } from '../../shared/periodo.helper';
import { importeConDosDecimales, importeOpcional } from '../../shared/validadores';
import { DIRECCIONES_PRESTAMO, METODOS_PRESTAMO } from '../prestamos.constants';

/** Corte que contiene `hoy` (si hay varios, el ACTIVO); si ninguno, `null`. */
export function corteParaHoy(cortes: CorteCobro[], hoy: string): CorteCobro | null {
  const vigentes = cortes.filter((c) => c.fecha_inicio.slice(0, 10) <= hoy && hoy <= c.fecha_final.slice(0, 10));
  return vigentes.find((c) => c.estado === 'ACTIVO') ?? vigentes[0] ?? null;
}

@Component({
  selector: 'app-formulario-prestamos',
  templateUrl: './formulario-prestamos.component.html',
  styleUrl: './formulario-prestamos.component.css'
})
export class FormularioPrestamosComponent implements OnInit, OnDestroy {
  @Output() creado = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  readonly metodos = METODOS_PRESTAMO;
  readonly direcciones = DIRECCIONES_PRESTAMO;

  cortes: CorteCobro[] = [];
  cargando = true;
  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group({
    valorPrestado: [null as number | null, [Validators.required, importeConDosDecimales]],
    concepto: ['', [Validators.required, Validators.maxLength(255)]],
    responsable: [null as number | null, Validators.required],
    direccionPrestamo: ['POR_COBRAR' as 'POR_COBRAR' | 'POR_PAGAR', Validators.required],
    metodo: [null as MetodoPrestamo | null],
    fechaPrestamo: [hoyIso(), Validators.required],
    fechaCobro: ['', Validators.required],
    corteId: [null as number | null],
    estado: ['Pendiente', Validators.required],
    esRecurrenteMensual: [false],
    cuotaMensualAcordada: [null as number | null, importeOpcional],
    comentarios: [''],
  });

  constructor(
    private prestamosService: PrestamosService,
    private cortesService: CortesCobroService
  ) {}

  ngOnInit(): void {
    // Las personas salen del catálogo compartido (el selector muestra su propio esqueleto/vacío/error); aquí solo se cargan los cortes.
    this.cortesService
      .getCortes()
      .pipe(
        catchError(() => of([] as CorteCobro[])),
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe((cortes) => {
        this.cortes = cortes;
        this.form.controls.corteId.setValue(corteParaHoy(cortes, hoyIso())?.id ?? null);
      });

    // La cuota mensual solo se exige cuando el préstamo es recurrente.
    this.form.controls.esRecurrenteMensual.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((recurrente) => {
      const c = this.form.controls.cuotaMensualAcordada;
      c.setValidators(recurrente ? [Validators.required, importeConDosDecimales] : [importeOpcional]);
      if (!recurrente) c.setValue(null);
      c.updateValueAndValidity();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Cuerpo exacto que se envía al backend (público para poder probarlo). */
  construirCuerpo(): CrearPrestamo {
    const v = this.form.getRawValue();
    return {
      valorPrestado: String(v.valorPrestado),
      concepto: (v.concepto ?? '').trim(),
      fechaCobro: v.fechaCobro as string,
      responsable: Number(v.responsable),
      estado: v.estado as string,
      comentarios: (v.comentarios ?? '').trim(),
      direccionPrestamo: v.direccionPrestamo ?? 'POR_COBRAR',
      fechaPrestamo: v.fechaPrestamo as string,
      ...(v.metodo ? { metodo: v.metodo } : {}),
      ...(v.corteId !== null && v.corteId !== undefined ? { corteId: Number(v.corteId) } : {}),
      ...(v.esRecurrenteMensual ? { esRecurrenteMensual: true, cuotaMensualAcordada: String(v.cuotaMensualAcordada) } : {}),
    };
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando = true;
    this.prestamosService
      .crearPrestamo(this.construirCuerpo())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: () => {
          this.reiniciar();
          this.creado.emit();
        },
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo registrar el préstamo.'))
      });
  }

  private reiniciar(): void {
    this.form.reset({
      valorPrestado: null,
      concepto: '',
      responsable: null,
      direccionPrestamo: 'POR_COBRAR',
      metodo: null,
      fechaPrestamo: hoyIso(),
      fechaCobro: '',
      corteId: corteParaHoy(this.cortes, hoyIso())?.id ?? null,
      estado: 'Pendiente',
      esRecurrenteMensual: false,
      cuotaMensualAcordada: null,
      comentarios: '',
    });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
