import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { MotivoReemplazo, PlasticoTarjeta, ReemplazarPlastico, ResultadoReemplazo, Tarjeta } from '../../modelos/tarjeta';
import { TarjetasService } from '../../services/tarjetas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { hoyIso } from '../../shared/periodo.helper';
import { MOTIVOS_REEMPLAZO, nombreTarjeta, terminacion } from '../tarjetas.constants';

/** Lo que se dice al usuario según los dígitos escritos: reemplazo nuevo, reactivar uno archivado o error. */
export type EfectoReemplazo =
  | { tipo: 'NUEVO' }
  | { tipo: 'REACTIVA'; plastico: PlasticoTarjeta }
  | { tipo: 'YA_ACTIVO'; plastico: PlasticoTarjeta };

export function efectoDelReemplazo(plasticos: PlasticoTarjeta[], ultimos4: string): EfectoReemplazo {
  const igual = plasticos.find((p) => p.ultimos4 === ultimos4);
  if (!igual) return { tipo: 'NUEVO' };
  return igual.esActivo ? { tipo: 'YA_ACTIVO', plastico: igual } : { tipo: 'REACTIVA', plastico: igual };
}

/** Cuerpo del POST: la fecha y el motivo solo viajan si se llenaron (sin ellos manda «hoy» y «sin motivo»). */
export function cuerpoReemplazo(v: { ultimos4: string; vigenteDesde: string; motivo: string; notas: string }): ReemplazarPlastico {
  return {
    ultimos4: v.ultimos4.trim(),
    ...(v.vigenteDesde ? { vigenteDesde: v.vigenteDesde } : {}),
    ...(v.motivo ? { motivo: v.motivo as MotivoReemplazo } : {}),
    ...(v.notas.trim() ? { notas: v.notas.trim() } : {}),
  };
}

@Component({
  selector: 'app-formulario-plastico',
  templateUrl: './formulario-plastico.component.html'
})
export class FormularioPlasticoComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) tarjeta!: Tarjeta;
  @Output() guardado = new EventEmitter<ResultadoReemplazo>();
  @Output() cancelar = new EventEmitter<void>();

  readonly motivos = MOTIVOS_REEMPLAZO;
  readonly terminacion = terminacion;
  readonly nombre = nombreTarjeta;

  enviando = false;
  errorServidor: string | null = null;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.nonNullable.group({
    ultimos4: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    vigenteDesde: [hoyIso(), Validators.required],
    motivo: [''],
    notas: ['', Validators.maxLength(500)],
  });

  constructor(private tarjetasService: TarjetasService) {}

  ngOnChanges(): void {
    this.form.reset({ ultimos4: '', vigenteDesde: hoyIso(), motivo: '', notas: '' });
    this.errorServidor = null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get activo(): PlasticoTarjeta | null {
    return this.tarjeta.plasticoActivo ?? (this.tarjeta.plasticos ?? []).find((p) => p.esActivo) ?? null;
  }

  get efecto(): EfectoReemplazo {
    return efectoDelReemplazo(this.tarjeta.plasticos ?? [], this.form.controls.ultimos4.value.trim());
  }

  get inicioAnteriorAlActivo(): boolean {
    const desde = this.activo?.vigenteDesde;
    const inicio = this.form.controls.vigenteDesde.value;
    return !!desde && !!inicio && inicio < desde.slice(0, 10);
  }

  campoInvalido(nombre: 'ultimos4' | 'vigenteDesde' | 'notas'): boolean {
    const c = this.form.controls[nombre];
    return c.invalid && (c.touched || c.dirty);
  }

  enviar(): void {
    this.errorServidor = null;
    if (this.form.invalid || this.efecto.tipo === 'YA_ACTIVO' || this.inicioAnteriorAlActivo) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando = true;
    this.tarjetasService
      .reemplazarPlastico(this.tarjeta.id as number, cuerpoReemplazo(this.form.getRawValue()))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.enviando = false))
      )
      .subscribe({
        next: (r) => this.guardado.emit(r),
        error: (err) => (this.errorServidor = mensajeDeError(err, 'No se pudo registrar el plástico.'))
      });
  }
}
