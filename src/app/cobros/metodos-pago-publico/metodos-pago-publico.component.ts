import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy } from '@angular/core';
import { MetodoPagoPublico } from '../../modelos/cobros-personas';
import { CobroPublicoService } from '../../services/cobro-publico.service';
import { copiarAlPortapapeles } from '../../shared/portapapeles.helper';
import { claseMetodoPago, etiquetaMetodoPago, iconoMetodoPago, numeroLegible, textoACopiar } from '../cobros-fase6.helpers';

/**
 * «¿Dónde puedes pagar?» del enlace público: una tarjeta estilo billetera (Apple Wallet) por cada medio de pago activo del
 * propietario, con un botón «Copiar número» que confirma con «¡Copiado!». El QR, si lo hay, se muestra bajo demanda.
 */
@Component({
  selector: 'app-metodos-pago-publico',
  templateUrl: './metodos-pago-publico.component.html',
  styleUrl: './metodos-pago-publico.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetodosPagoPublicoComponent implements OnDestroy {
  @Input({ required: true }) metodos: MetodoPagoPublico[] = [];
  @Input({ required: true }) token = '';
  /** Texto libre que el propietario escribió para este enlace (se muestra como «Indicaciones»). */
  @Input() instrucciones: string | null = null;

  readonly clase = claseMetodoPago;
  readonly icono = iconoMetodoPago;
  readonly etiqueta = etiquetaMetodoPago;
  readonly legible = numeroLegible;

  /** Medio cuyo número se acaba de copiar (muestra «¡Copiado!»). */
  copiado: number | 'indicaciones' | null = null;
  errorCopia: number | 'indicaciones' | null = null;
  qrAbierto: number | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private servicio: CobroPublicoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
  }

  async copiar(m: MetodoPagoPublico): Promise<void> {
    await this.marcar(m.id, textoACopiar(m));
  }

  async copiarIndicaciones(): Promise<void> {
    if (this.instrucciones) await this.marcar('indicaciones', this.instrucciones);
  }

  private async marcar(clave: number | 'indicaciones', texto: string): Promise<void> {
    const ok = await copiarAlPortapapeles(texto);
    this.copiado = ok ? clave : null;
    this.errorCopia = ok ? null : clave;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.copiado = null;
      this.errorCopia = null;
      this.cdr.markForCheck();
    }, 2500);
    this.cdr.markForCheck();
  }

  alternarQr(m: MetodoPagoPublico): void {
    this.qrAbierto = this.qrAbierto === m.id ? null : m.id;
  }

  urlQr(m: MetodoPagoPublico): string {
    return this.servicio.urlQr(this.token, m.id);
  }

  trackId(_: number, m: MetodoPagoPublico): number {
    return m.id;
  }
}
