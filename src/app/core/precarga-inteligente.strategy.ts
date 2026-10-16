import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

/** Lo mínimo que usamos de la API de red del navegador (`navigator.connection`; no está en todos los navegadores). */
interface ConexionLike {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * ¿Conviene descargar en segundo plano las demás pantallas? Sí, salvo que el usuario haya pedido ahorrar datos o la conexión sea
 * lenta (2G/3G): ahí cada pantalla se baja solo cuando se abre.
 */
export function puedePrecargar(conexion: ConexionLike | undefined): boolean {
  if (!conexion) return true;
  if (conexion.saveData) return false;
  return !['slow-2g', '2g', '3g'].includes(conexion.effectiveType ?? '');
}

/**
 * Después de pintar la pantalla inicial, trae los paquetes del resto de secciones de a poco y en tiempo ocioso, para que navegar sea
 * instantáneo sin competir con la carga de lo que el usuario está viendo.
 */
@Injectable({ providedIn: 'root' })
export class PrecargaInteligente implements PreloadingStrategy {
  /** Espera antes de empezar (ms): deja respirar a la primera pantalla. */
  retardoMs = 1500;

  preload(_ruta: Route, cargar: () => Observable<unknown>): Observable<unknown> {
    const conexion = (typeof navigator !== 'undefined' ? (navigator as Navigator & { connection?: ConexionLike }).connection : undefined) as ConexionLike | undefined;
    if (!puedePrecargar(conexion)) return of(null);
    return timer(this.retardoMs).pipe(mergeMap(() => cargar()));
  }
}
