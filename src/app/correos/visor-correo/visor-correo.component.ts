import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { NotificacionCorreo } from '../../modelos/erp';
import { VistaCorreo, interpretarCorreo } from '../correos.constants';
import { CuerpoLimpio, SegmentoCuerpo, TokenCuerpo, limpiarCuerpo, segmentarCuerpo } from './visor-correo.helpers';

/**
 * Visor de un correo del banco, al estilo de Mail: quién lo envía, cuándo, el asunto y el cuerpo con lo importante resaltado
 * —montos, fechas, los últimos 4 dígitos y el comercio—. Tocar un resaltado lo envía al formulario de conciliación
 * (`usar`), que lo pone en el campo que corresponde.
 */
@Component({
  selector: 'app-visor-correo',
  templateUrl: './visor-correo.component.html',
  styleUrl: './visor-correo.component.css',
})
export class VisorCorreoComponent implements OnChanges {
  @Input({ required: true }) notificacion!: NotificacionCorreo;
  /** Se emite al tocar un resaltado del cuerpo. */
  @Output() usar = new EventEmitter<TokenCuerpo>();

  vista!: VistaCorreo;
  cuerpo: CuerpoLimpio = { principal: '', resto: '', recortado: false };
  segmentos: SegmentoCuerpo[] = [];
  /** Cuántos resaltados hay de cada clase (para la leyenda). */
  hay: Record<TokenCuerpo['tipo'], boolean> = { monto: false, fecha: false, ultimos4: false, comercio: false };
  /** Los que ya se tocaron: quedan marcados para que se vea qué se usó. */
  private usados = new Set<string>();

  ngOnChanges(): void {
    this.vista = interpretarCorreo(this.notificacion);
    this.cuerpo = limpiarCuerpo(this.notificacion.cuerpo_extraido);
    this.segmentos = segmentarCuerpo(this.cuerpo.principal, this.vista.comercio);
    this.hay = { monto: false, fecha: false, ultimos4: false, comercio: false };
    for (const s of this.segmentos) if (s.token) this.hay[s.token.tipo] = true;
    this.usados.clear();
  }

  /** «Bancolombia (Gmail)» → «Bancolombia». */
  get remitente(): string {
    const r = (this.notificacion.remitente ?? '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/<.*>/, '').trim();
    return r || 'Banco';
  }

  get inicial(): string {
    return this.remitente.charAt(0).toUpperCase();
  }

  tocar(token: TokenCuerpo): void {
    this.usados.add(this.clave(token));
    this.usar.emit(token);
  }

  esUsado(token: TokenCuerpo): boolean {
    return this.usados.has(this.clave(token));
  }

  private clave(token: TokenCuerpo): string {
    return `${token.tipo}:${token.valor}`;
  }

  trackSegmento(i: number): number {
    return i;
  }
}
