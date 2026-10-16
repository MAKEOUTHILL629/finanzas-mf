import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { EnlaceCobro, GenerarEnlace } from '../../modelos/cobros-personas';
import { CobrosPersonasService } from '../../services/cobros-personas.service';
import { mensajeDeError } from '../../shared/http-error.helper';
import { nombrePeriodo } from '../../shared/periodo.helper';
import { copiarAlPortapapeles } from '../../shared/portapapeles.helper';
import { ToastService } from '../../shared/toast/toast.service';
import { enlaceWhatsApp, telefonoWhatsApp, textoParaCompartir, urlPublica, vencimientoLegible } from '../cobros.constants';

const CLAVE_INSTRUCCIONES = 'finanzas-instrucciones-pago';

function recordarInstrucciones(valor?: string): string {
  try {
    if (valor !== undefined) {
      localStorage.setItem(CLAVE_INSTRUCCIONES, valor);
      return valor;
    }
    return localStorage.getItem(CLAVE_INSTRUCCIONES) ?? '';
  } catch {
    return valor ?? ''; // sin almacenamiento: solo vale para esta sesión
  }
}

/** Opciones de vigencia del enlace. */
export const VIGENCIAS: ReadonlyArray<{ dias: number; etiqueta: string }> = [
  { dias: 15, etiqueta: '15 días' },
  { dias: 30, etiqueta: '30 días' },
  { dias: 45, etiqueta: '45 días' },
  { dias: 90, etiqueta: '90 días' },
];

/** Cuerpo de `POST /cobros/enlaces` a partir del formulario. */
export function construirEnlace(personaId: number, periodo: string, v: { mensaje: string; instruccionesPago: string; diasVigencia: number }, rotarToken = false): GenerarEnlace {
  return {
    personaId,
    periodo,
    mensaje: v.mensaje.trim(),
    instruccionesPago: v.instruccionesPago.trim(),
    diasVigencia: v.diasVigencia,
    ...(rotarToken ? { rotarToken: true } : {}),
  };
}

/**
 * Comparte con una persona el detalle de lo que debe en un mes: genera el enlace (con una foto de su liquidación), lo copia o lo
 * manda por WhatsApp. Desde ese enlace la persona puede avisar que pagó y adjuntar su comprobante.
 */
@Component({
  selector: 'app-compartir-cobro',
  templateUrl: './compartir-cobro.component.html',
  styleUrl: './compartir-cobro.component.css'
})
export class CompartirCobroComponent implements OnInit, OnDestroy {
  @Input({ required: true }) personaId!: number;
  @Input() nombre: string | null = null;
  @Input() celular: string | null = null;
  @Input({ required: true }) periodo!: string;
  /** Se generó, actualizó o desactivó un enlace (el padre puede recargar). */
  @Output() cambiado = new EventEmitter<void>();
  @Output() cerrar = new EventEmitter<void>();

  readonly vigencias = VIGENCIAS;
  readonly nombrePeriodo = nombrePeriodo;
  readonly vence = vencimientoLegible;

  cargando = true;
  trabajando = false;
  error: string | null = null;
  enlace: EnlaceCobro | null = null;
  copiado = false;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.nonNullable.group({
    mensaje: ['', Validators.maxLength(600)],
    instruccionesPago: ['', Validators.maxLength(600)],
    diasVigencia: [45],
  });

  constructor(
    private cobros: CobrosPersonasService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    const quien = (this.nombre ?? '').trim().split(/\s+/)[0];
    this.form.patchValue({
      mensaje: `Hola${quien ? ' ' + quien : ''}, este es el resumen de ${nombrePeriodo(this.periodo)}. Cualquier duda me dices.`,
      instruccionesPago: recordarInstrucciones(),
    });
    this.cobros
      .getEnlaces(this.periodo)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (lista) => {
          const e = lista.find((x) => x.personaId === this.personaId) ?? null;
          this.enlace = e;
          if (e) this.form.patchValue({ mensaje: e.mensaje ?? '', instruccionesPago: e.instruccionesPago ?? this.form.controls.instruccionesPago.value });
        },
        error: (err) => (this.error = mensajeDeError(err, 'No se pudo consultar el enlace.'))
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get url(): string {
    return this.enlace ? urlPublica(this.enlace.token, window.location.origin) : '';
  }

  get whatsapp(): string {
    const texto = textoParaCompartir(this.nombre, this.periodo, this.url, this.enlace?.resumen?.saldoTotalAcumulado);
    return enlaceWhatsApp(telefonoWhatsApp(this.celular), texto);
  }

  generar(rotar = false): void {
    if (this.form.invalid) return;
    this.trabajando = true;
    this.error = null;
    const v = this.form.getRawValue();
    this.cobros
      .generarEnlace(construirEnlace(this.personaId, this.periodo, v, rotar))
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (e) => {
          recordarInstrucciones(v.instruccionesPago.trim());
          const nuevo = !this.enlace || rotar;
          this.enlace = e;
          this.copiado = false;
          this.toast.exito(nuevo ? 'Enlace listo para compartir.' : 'Enlace actualizado con la liquidación de hoy.');
          this.cambiado.emit();
        },
        error: (err) => (this.error = mensajeDeError(err, 'No se pudo generar el enlace.'))
      });
  }

  async copiar(): Promise<void> {
    if (!this.enlace) return;
    this.copiado = await copiarAlPortapapeles(this.url);
    if (!this.copiado) this.toast.info(this.url);
  }

  desactivar(): void {
    if (!this.enlace) return;
    this.trabajando = true;
    this.cobros
      .revocarEnlace(this.enlace.id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.trabajando = false))
      )
      .subscribe({
        next: (e) => {
          this.enlace = e;
          this.toast.exito('Enlace desactivado: ya no abre.');
          this.cambiado.emit();
        },
        error: (err) => (this.error = mensajeDeError(err, 'No se pudo desactivar el enlace.'))
      });
  }
}
