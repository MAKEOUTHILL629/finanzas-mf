import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ActualizarPrestamo, CorteCobro, EstadoPrestamo, MetodoPrestamo, PrestamoDetalle } from '../../modelos/cobros';
import { PrestamosService } from '../../services/prestamos.service';
import { formatDateOnly } from '../../shared/date-only.helper';
import { mensajeDeError } from '../../shared/http-error.helper';
import { importeNoNegativoOpcional } from '../../shared/validadores';
import { METODOS_PRESTAMO, estaPendiente } from '../prestamos.constants';

export interface ValoresEdicionPrestamo {
  estado: string;
  saldoPendiente: number | string | null;
  metodo: string | null;
  corteId: number | null;
  /** `yyyy-MM-dd` */
  fechaCobro: string;
  comentarios: string;
}

/** Valores iniciales del formulario a partir del préstamo (las fechas de calendario llegan como epoch-ms UTC). */
export function valoresDe(p: PrestamoDetalle): ValoresEdicionPrestamo {
  return {
    estado: p.estado,
    saldoPendiente: p.saldoPendiente,
    metodo: p.metodo ?? null,
    corteId: p.corteId,
    fechaCobro: p.fechaCobro === null ? '' : formatDateOnly(p.fechaCobro),
    comentarios: p.comentarios ?? '',
  };
}

/**
 * Solo los campos que cambiaron respecto al préstamo original. El backend no admite quitar el corte ni el método
 * (null), por eso un valor vacío nunca se envía.
 */
export function calcularCambios(original: PrestamoDetalle, v: ValoresEdicionPrestamo): ActualizarPrestamo {
  const base = valoresDe(original);
  const cambios: ActualizarPrestamo = {};
  if (v.estado !== base.estado) cambios.estado = v.estado as EstadoPrestamo;
  const saldoNuevo = v.saldoPendiente === null || v.saldoPendiente === '' ? null : Number(v.saldoPendiente);
  if (saldoNuevo !== null && saldoNuevo !== (base.saldoPendiente === null ? null : Number(base.saldoPendiente))) {
    cambios.saldoPendiente = String(v.saldoPendiente);
  }
  if (v.metodo && v.metodo !== base.metodo) cambios.metodo = v.metodo as MetodoPrestamo;
  if (v.corteId !== null && v.corteId !== undefined && v.corteId !== base.corteId) cambios.corteId = Number(v.corteId);
  if (v.fechaCobro && v.fechaCobro !== base.fechaCobro) cambios.fechaCobro = v.fechaCobro;
  if (v.comentarios.trim() !== base.comentarios.trim()) cambios.comentarios = v.comentarios.trim();
  return cambios;
}

@Component({
  selector: 'app-formulario-editar-prestamo',
  templateUrl: './formulario-editar-prestamo.component.html'
})
export class FormularioEditarPrestamoComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) prestamo!: PrestamoDetalle;
  @Input() cortes: CorteCobro[] = [];
  @Output() actualizado = new EventEmitter<PrestamoDetalle>();
  @Output() cancelar = new EventEmitter<void>();

  readonly metodos = METODOS_PRESTAMO;
  enviando = false;
  errorServidor: string | null = null;
  sinCambios = false;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group({
    estado: ['Pendiente', Validators.required],
    saldoPendiente: [null as number | string | null, importeNoNegativoOpcional],
    metodo: [null as string | null],
    corteId: [null as number | null],
    fechaCobro: ['', Validators.required],
    comentarios: [''],
  });

  constructor(private prestamosService: PrestamosService) {}

  ngOnChanges(): void {
    if (this.prestamo) {
      this.form.reset(valoresDe(this.prestamo));
      this.errorServidor = null;
      this.sinCambios = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** ¿El préstamo pasa de Pendiente a Pagado sin tocar el saldo? Entonces el backend lo deja en 0 tras el abono. */
  get pasaAPagado(): boolean {
    const v = this.form.getRawValue();
    return v.estado === 'Pagado' && estaPendiente(this.prestamo);
  }

  enviar(): void {
    this.errorServidor = null;
    this.sinCambios = false;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const cambios = calcularCambios(this.prestamo, this.form.getRawValue() as ValoresEdicionPrestamo);
    if (Object.keys(cambios).length === 0) {
      this.sinCambios = true;
      return;
    }
    this.enviando = true;
    this.prestamosService
      .actualizarPrestamo(this.prestamo.id, cambios)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (p) => this.actualizado.emit(p),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo actualizar el préstamo.'))
      });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
