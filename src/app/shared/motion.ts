import { animate, style, transition, trigger } from '@angular/animations';

/**
 * Preferencia de «reducir movimiento» del sistema operativo. Las animaciones de CSS la respetan solas (ver base.css); las que
 * hace Angular (`@angular/animations`) o el código (conteos) la consultan aquí.
 */
export function MOVIMIENTO_REDUCIDO(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Duración de una animación de Angular: `0ms` si el usuario pidió reducir el movimiento. */
export function duracion(ms: number): string {
  return MOVIMIENTO_REDUCIDO() ? '0ms' : `${ms}ms`;
}

/** Curvas de movimiento del sistema (las mismas que `--ease-*` de tokens.css, para las animaciones hechas en código). */
export const CURVA = {
  /** Se asienta con suavidad (hojas, paneles). */
  salida: 'cubic-bezier(0.16, 1, 0.3, 1)',
  /** Resorte con un pequeño rebote (diálogos, acordeones, indicadores). */
  resorte: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** Hoja de iOS: sin rebote. */
  hoja: 'cubic-bezier(0.32, 0.72, 0, 1)',
  estandar: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

/** Resorte más suave, para crecer en altura sin pasarse demasiado. */
const RESORTE_SUAVE = 'cubic-bezier(0.3, 1.25, 0.5, 1)';

/**
 * Despliegue con resorte (acordeones de desglose): al aparecer crece en altura con un pequeño rebote y se asienta; al irse se pliega.
 * Se usa con `*ngIf` y `[@expandir]`. Con «reducir movimiento» el cambio es inmediato.
 */
export const EXPANDIR = trigger('expandir', [
  transition(':enter', [
    style({ height: 0, opacity: 0, overflow: 'hidden' }),
    animate(`${duracion(480)} ${RESORTE_SUAVE}`, style({ height: '*', opacity: 1 })),
  ]),
  transition(':leave', [style({ height: '*', overflow: 'hidden' }), animate(`${duracion(240)} ${CURVA.estandar}`, style({ height: 0, opacity: 0 }))]),
]);
