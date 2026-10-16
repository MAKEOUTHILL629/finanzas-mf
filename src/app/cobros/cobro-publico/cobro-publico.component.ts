import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { CobroPublico, ComprobanteEnvio, ItemCobroPublico, MedioPago, ResumenCobro } from '../../modelos/cobros-personas';
import { CobroPublicoService } from '../../services/cobro-publico.service';
import { prepararComprobante, tamanoLegible } from '../../shared/archivo.helper';
import { esImporteValido } from '../../shared/dinero.helper';
import { iniciales } from '../../deudas/deudas.constants';
import { hoyIso, nombrePeriodo } from '../../shared/periodo.helper';
import { copiarAlPortapapeles } from '../../shared/portapapeles.helper';
import { MEDIOS_PAGO, claseEstadoReporte, etiquetaEstadoReporte, etiquetaMedio, lineaDetalle, vencimientoLegible } from '../cobros.constants';

export interface ResumenSaldo {
  /** Texto de arriba: «Debes a Felipe», «Estás al día», «Tienes saldo a favor». */
  titulo: string;
  /** Monto que se muestra en grande (siempre positivo). */
  monto: number;
  clase: 'debe' | 'alDia' | 'aFavor';
  /** Lo que se sugiere pagar (0 si no debe nada). */
  porPagar: number;
}

/** Lo más importante de la página: ¿cuánto debe la persona hoy (lo del mes más lo que arrastra)? */
export function resumenSaldo(r: Pick<ResumenCobro, 'saldoTotalAcumulado'>, propietario: string | null | undefined): ResumenSaldo {
  const saldo = Math.round(r.saldoTotalAcumulado * 100) / 100;
  const quien = (propietario ?? '').trim().split(/\s+/)[0];
  if (saldo > 0) return { titulo: quien ? `Le debes a ${quien}` : 'Tu saldo pendiente', monto: saldo, clase: 'debe', porPagar: saldo };
  if (saldo < 0) return { titulo: 'Tienes saldo a favor', monto: Math.abs(saldo), clase: 'aFavor', porPagar: 0 };
  return { titulo: 'Estás al día', monto: 0, clase: 'alDia', porPagar: 0 };
}

/** Mensaje claro para la persona según el error del servidor. */
export function mensajePublico(err: unknown, porDefecto: string): string {
  const e = err as { status?: number; isNetworkError?: boolean; isTimeout?: boolean; error?: { message?: unknown; errors?: Record<string, unknown> } } | null;
  if (!e) return porDefecto;
  if (e.isNetworkError || e.status === 0) return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.';
  if (e.isTimeout) return 'La conexión está muy lenta. Inténtalo de nuevo en un momento.';
  if (e.status === 404) return 'Este enlace no es válido o ya venció. Pídele a quien te lo envió que te comparta uno nuevo.';
  if (e.status === 429) return 'Hiciste muchos intentos seguidos. Espera unos minutos e inténtalo de nuevo.';
  const detalles = e.error?.errors ? Object.values(e.error.errors).flat().map(String) : [];
  if (detalles.length) return detalles.slice(0, 2).join(' · ');
  const m = e.error?.message;
  return typeof m === 'string' && m.trim() ? m.trim() : porDefecto;
}

@Component({
  selector: 'app-cobro-publico',
  templateUrl: './cobro-publico.component.html',
  styleUrl: './cobro-publico.component.css'
})
export class CobroPublicoComponent implements OnInit, OnDestroy {
  readonly medios = MEDIOS_PAGO;
  readonly nombrePeriodo = nombrePeriodo;
  readonly iniciales = iniciales;
  readonly detalle = lineaDetalle;
  readonly resumen = resumenSaldo;
  readonly vence = vencimientoLegible;
  readonly estado = etiquetaEstadoReporte;
  readonly claseEstado = claseEstadoReporte;
  readonly medio = etiquetaMedio;
  readonly tamano = tamanoLegible;

  token = '';
  cobro: CobroPublico | null = null;
  cargando = true;
  error: string | null = null;

  // reporte de pago
  reportando = false;
  errorReporte: string | null = null;
  enviado: string | null = null;
  comprobante: ComprobanteEnvio | null = null;
  vistaPrevia: string | null = null;
  leyendoArchivo = false;
  errorArchivo: string | null = null;
  intentado = false;
  copiado = false;

  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  form = this.fb.nonNullable.group({
    monto: ['' as number | string, Validators.required],
    fechaPago: [hoyIso(), Validators.required],
    medio: ['BREB' as MedioPago],
    referencia: ['', Validators.maxLength(80)],
    comentario: ['', Validators.maxLength(500)],
  });

  private tituloAnterior = '';

  constructor(
    private route: ActivatedRoute,
    private servicio: CobroPublicoService,
    private meta: Meta,
    private titulo: Title
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    // Página privada de una persona: que ningún buscador la indexe.
    this.meta.addTag({ name: 'robots', content: 'noindex, nofollow' }, true);
    this.tituloAnterior = this.titulo.getTitle();
    this.titulo.setTitle('Tu resumen de pagos');
    this.cargar();
  }

  ngOnDestroy(): void {
    this.meta.removeTag("name='robots'");
    this.titulo.setTitle(this.tituloAnterior);
    this.liberarVistaPrevia();
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.servicio
      .getCobro(this.token)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.cargando = false))
      )
      .subscribe({
        next: (c) => {
          this.cobro = c;
          const sugerido = resumenSaldo(c.resumen, c.propietario.nombre).porPagar;
          if (this.form.controls.monto.value === '' && sugerido > 0) this.form.controls.monto.setValue(sugerido);
        },
        error: (err) => {
          this.cobro = null;
          this.error = mensajePublico(err, 'No se pudo abrir este enlace.');
        }
      });
  }

  get saldo(): ResumenSaldo | null {
    return this.cobro ? resumenSaldo(this.cobro.resumen, this.cobro.propietario.nombre) : null;
  }

  get nombrePropietario(): string {
    return (this.cobro?.propietario.nombre ?? '').trim() || 'quien te cobra';
  }

  get montoInvalido(): boolean {
    return !esImporteValido(this.form.controls.monto.value);
  }

  async copiarInstrucciones(): Promise<void> {
    const t = this.cobro?.instruccionesPago;
    if (!t) return;
    this.copiado = await copiarAlPortapapeles(t);
    setTimeout(() => (this.copiado = false), 2500);
  }

  // ── comprobante ──

  async alElegirArchivo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo) return;
    this.errorArchivo = null;
    this.leyendoArchivo = true;
    try {
      const c = await prepararComprobante(archivo);
      this.liberarVistaPrevia();
      this.comprobante = c;
      if (c.tipo !== 'application/pdf') this.vistaPrevia = `data:${c.tipo};base64,${c.datos}`;
    } catch (e) {
      this.comprobante = null;
      this.errorArchivo = e instanceof Error ? e.message : 'No se pudo leer el archivo.';
      entrada.value = '';
    } finally {
      this.leyendoArchivo = false;
    }
  }

  /** Al quitar el comprobante el selector de archivo se vuelve a crear (queda vacío). */
  quitarArchivo(): void {
    this.comprobante = null;
    this.errorArchivo = null;
    this.liberarVistaPrevia();
  }

  private liberarVistaPrevia(): void {
    this.vistaPrevia = null;
  }

  get tamanoComprobante(): number {
    return this.comprobante ? Math.floor((this.comprobante.datos.length * 3) / 4) : 0;
  }

  // ── enviar ──

  reportar(): void {
    this.intentado = true;
    this.errorReporte = null;
    if (this.form.invalid || this.montoInvalido || this.leyendoArchivo) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.reportando = true;
    this.servicio
      .reportarPago(this.token, {
        monto: String(v.monto),
        fechaPago: v.fechaPago,
        medio: v.medio,
        ...(v.referencia.trim() ? { referencia: v.referencia.trim() } : {}),
        ...(v.comentario.trim() ? { comentario: v.comentario.trim() } : {}),
        ...(this.comprobante ? { comprobante: this.comprobante } : {}),
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.reportando = false))
      )
      .subscribe({
        next: (r) => {
          this.enviado = r.mensaje;
          this.comprobante = null;
          this.liberarVistaPrevia();
          this.intentado = false;
          this.form.patchValue({ monto: '', referencia: '', comentario: '' });
          this.cargar();
        },
        error: (err) => (this.errorReporte = mensajePublico(err, 'No se pudo enviar tu reporte. Inténtalo de nuevo.'))
      });
  }

  trackItem(i: number, _: ItemCobroPublico): number {
    return i;
  }
}
