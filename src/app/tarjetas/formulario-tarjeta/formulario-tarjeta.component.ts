import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ActualizarTarjeta } from '../../modelos/erp';
import { Tarjeta } from '../../modelos/tarjeta';
import { TarjetasService } from '../../services/tarjetas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { importeNoNegativoOpcional, importeOpcional } from '../../shared/validadores';

export interface ValoresTarjeta {
  franquicia: string;
  descripcion: string;
  diaCorte: number | null;
  diaLimitePago: number | null;
  cupoTotal: number | string | null;
  permiteDolares: boolean;
  tasaInteresCompra: number | string | null;
  tasaInteresAvance: number | string | null;
  cuotaManejo: number | string | null;
}

export function valoresDeTarjeta(t: Tarjeta): ValoresTarjeta {
  return {
    franquicia: t.franquicia ?? '',
    descripcion: t.descripcion ?? '',
    diaCorte: t.diaCorte ?? null,
    diaLimitePago: t.diaLimitePago ?? null,
    cupoTotal: t.cupoTotal ?? null,
    permiteDolares: !!t.permiteDolares,
    tasaInteresCompra: t.tasaInteresCompra ?? null,
    tasaInteresAvance: t.tasaInteresAvance ?? null,
    cuotaManejo: t.cuotaManejo ?? null,
  };
}

const vacio = (v: unknown) => v === null || v === undefined || v === '';
const igual = (a: unknown, b: unknown) => (vacio(a) && vacio(b)) || (!vacio(a) && !vacio(b) && Number(a) === Number(b));

/** Solo lo que cambió. Un número vacío nunca se envía (el backend no permite "borrar" estos valores). */
export function cambiosDeTarjeta(original: Tarjeta, v: ValoresTarjeta): ActualizarTarjeta {
  const base = valoresDeTarjeta(original);
  const cambios: ActualizarTarjeta = {};
  if (v.franquicia.trim() !== base.franquicia.trim()) cambios.franquicia = v.franquicia.trim();
  if (v.descripcion.trim() !== base.descripcion.trim()) cambios.descripcion = v.descripcion.trim();
  if (!vacio(v.diaCorte) && !igual(v.diaCorte, base.diaCorte)) cambios.diaCorte = Number(v.diaCorte);
  if (!vacio(v.diaLimitePago) && !igual(v.diaLimitePago, base.diaLimitePago)) cambios.diaLimitePago = Number(v.diaLimitePago);
  if (!vacio(v.cupoTotal) && !igual(v.cupoTotal, base.cupoTotal)) cambios.cupoTotal = String(v.cupoTotal);
  if (v.permiteDolares !== base.permiteDolares) cambios.permiteDolares = v.permiteDolares;
  if (!vacio(v.tasaInteresCompra) && !igual(v.tasaInteresCompra, base.tasaInteresCompra)) cambios.tasaInteresCompra = String(v.tasaInteresCompra);
  if (!vacio(v.tasaInteresAvance) && !igual(v.tasaInteresAvance, base.tasaInteresAvance)) cambios.tasaInteresAvance = String(v.tasaInteresAvance);
  if (!vacio(v.cuotaManejo) && !igual(v.cuotaManejo, base.cuotaManejo)) cambios.cuotaManejo = String(v.cuotaManejo);
  return cambios;
}

/** Hasta 4 decimales (tasas en %), valor >= 0, vacío válido. */
function tasaOpcional(control: { value: unknown }) {
  const v = control.value;
  return vacio(v) || (/^\d+(\.\d{1,4})?$/.test(String(v).trim()) && Number(v) <= 100) ? null : { tasa: true };
}

@Component({
  selector: 'app-formulario-tarjeta',
  templateUrl: './formulario-tarjeta.component.html'
})
export class FormularioTarjetaComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) tarjeta!: Tarjeta;
  @Output() guardada = new EventEmitter<Tarjeta>();
  @Output() cancelar = new EventEmitter<void>();

  enviando = false;
  errorServidor: string | null = null;
  sinCambios = false;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.group({
    franquicia: ['', Validators.maxLength(255)],
    descripcion: ['', Validators.maxLength(255)],
    diaCorte: [null as number | null, [Validators.min(1), Validators.max(31), Validators.pattern(/^\d+$/)]],
    diaLimitePago: [null as number | null, [Validators.min(1), Validators.max(31), Validators.pattern(/^\d+$/)]],
    cupoTotal: [null as number | string | null, importeOpcional],
    permiteDolares: [false],
    tasaInteresCompra: [null as number | string | null, tasaOpcional],
    tasaInteresAvance: [null as number | string | null, tasaOpcional],
    cuotaManejo: [null as number | string | null, importeNoNegativoOpcional],
  });

  constructor(private tarjetasService: TarjetasService) {}

  ngOnChanges(): void {
    if (this.tarjeta) {
      this.form.reset(valoresDeTarjeta(this.tarjeta));
      this.errorServidor = null;
      this.sinCambios = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  enviar(): void {
    this.errorServidor = null;
    this.sinCambios = false;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const cambios = cambiosDeTarjeta(this.tarjeta, this.form.getRawValue() as ValoresTarjeta);
    if (Object.keys(cambios).length === 0) {
      this.sinCambios = true;
      return;
    }
    this.enviando = true;
    this.tarjetasService
      .actualizarTarjeta(this.tarjeta.id as number, cambios)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (t) => this.guardada.emit(t),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo guardar la tarjeta.'))
      });
  }

  campoInvalido(nombre: string): boolean {
    const c = this.form.get(nombre);
    return !!c && c.invalid && (c.touched || c.dirty);
  }
}
