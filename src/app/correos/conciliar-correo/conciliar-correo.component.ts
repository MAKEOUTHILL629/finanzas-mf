import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { NotificacionCorreo, ResultadoConciliacion } from '../../modelos/erp';
import { FormularioConciliarComponent, UsoDelCorreo } from '../formulario-conciliar/formulario-conciliar.component';

export type PestanaConciliar = 'correo' | 'formulario';

/**
 * Conciliar un correo viendo el correo: a la izquierda el visor (quién, cuándo, asunto y cuerpo con lo importante resaltado) y a la
 * derecha el formulario. Tocar un resaltado lo copia al campo que corresponde. En pantallas angostas son dos pestañas.
 */
@Component({
  selector: 'app-conciliar-correo',
  templateUrl: './conciliar-correo.component.html',
  styleUrl: './conciliar-correo.component.css',
})
export class ConciliarCorreoComponent {
  @Input({ required: true }) notificacion!: NotificacionCorreo;
  @Output() conciliada = new EventEmitter<ResultadoConciliacion>();
  @Output() cancelar = new EventEmitter<void>();

  @ViewChild(FormularioConciliarComponent) formulario?: FormularioConciliarComponent;

  /** Pestaña visible en pantallas angostas (en las anchas se ven las dos). */
  pestana: PestanaConciliar = 'correo';
  /** Qué pasó con el último resaltado tocado (se muestra junto al correo, que es donde se toca). */
  aviso: string | null = null;

  elegir(p: PestanaConciliar): void {
    this.pestana = p;
  }

  alUsar(uso: UsoDelCorreo): void {
    this.aviso = this.formulario?.aplicar(uso) ?? null;
  }
}
