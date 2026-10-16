import { Directive, Input, TemplateRef } from '@angular/core';

export type AlineacionColumna = 'inicio' | 'fin' | 'centro';
export type FormatoColumna = 'texto' | 'moneda' | 'numero' | 'porcentaje' | 'fecha' | 'fechaCorta';
export type DireccionOrden = 'asc' | 'desc';
export type ValorCelda = string | number | boolean | Date | null | undefined;

/** Cómo es una columna de `<app-apple-table>`. */
export interface ColumnaTabla<T = unknown> {
  id: string;
  titulo: string;
  /** Valor de la celda: se usa para mostrarla (con `formato`) y para ordenar. Si hay una plantilla `appCelda`, solo para ordenar. */
  valor?: (fila: T) => ValorCelda;
  formato?: FormatoColumna;
  /** Por defecto es ordenable cuando tiene `valor`. */
  ordenable?: boolean;
  /** Comparador propio (por ejemplo, para ordenar un estado por su gravedad y no alfabéticamente). */
  comparar?: (a: T, b: T) => number;
  /** Las cifras van a la derecha (`fin`). Por defecto: `fin` para moneda/número/porcentaje, `inicio` para el resto. */
  alineacion?: AlineacionColumna;
  /**
   * 1 = siempre visible y parte del resumen de la tarjeta en móvil · 2 = se oculta si no cabe · 3 = se oculta primero.
   * Por defecto 2.
   */
  prioridad?: 1 | 2 | 3;
  /** Ancho mínimo recomendado en px; con él se decide cuántas columnas caben sin scroll horizontal. */
  anchoMin?: number;
  ocultaPorDefecto?: boolean;
  /** Texto largo: se corta con «…» y el valor completo se ve al pasar el cursor. */
  truncar?: boolean;
  /** Etiqueta en la tarjeta móvil si debe ser distinta del título. */
  etiquetaMovil?: string;
}

export interface OrdenTabla {
  columna: string;
  direccion: DireccionOrden;
}

export interface CambioPagina {
  /** 0 = primera. */
  pagina: number;
  tamano: number;
}

/** Contenido propio de las celdas de una columna: `<ng-template appCelda="estado" let-fila>…</ng-template>`. */
@Directive({ selector: 'ng-template[appCelda]' })
export class CeldaTablaDirective {
  @Input('appCelda') columna = '';
  constructor(public plantilla: TemplateRef<unknown>) {}
}

/** Botones de acción de cada fila (última columna en escritorio; dentro de la tarjeta expandida en móvil). */
@Directive({ selector: 'ng-template[appAccionesFila]' })
export class AccionesFilaDirective {
  constructor(public plantilla: TemplateRef<unknown>) {}
}

/** Resumen propio de la fila en móvil, si el automático (columnas de prioridad 1) no alcanza. */
@Directive({ selector: 'ng-template[appTarjetaFila]' })
export class TarjetaFilaDirective {
  constructor(public plantilla: TemplateRef<unknown>) {}
}
