import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { ComercioHabitual, DEFAULTS_VACIOS, DefaultsFormularios } from '../modelos/sugerencias';
import { ApiServicesService } from './api-services.service';

/** Cuánto vale lo que se aprendió del historial antes de volver a preguntarlo. */
export const VIGENCIA_SUGERENCIAS_MS = 5 * 60_000;

interface Guardado<T> {
  hasta: number;
  datos$: Observable<T>;
}

/**
 * Lo que los formularios pre-llenan a partir de tu historial (`/api/sugerencias`): la tarjeta, cuenta y personas habituales y los
 * comercios que ya usaste. Se guarda en memoria unos minutos (abrir varios formularios seguidos no repite la consulta) y NUNCA falla:
 * si el servidor no responde los formularios arrancan como siempre, sin valores sugeridos.
 */
@Injectable({ providedIn: 'root' })
export class SugerenciasService {
  private formulariosGuardado: Guardado<DefaultsFormularios> | null = null;
  private comerciosGuardado: Guardado<ComercioHabitual[]> | null = null;
  /** Para pruebas: el reloj. */
  ahora: () => number = () => Date.now();

  constructor(private api: ApiServicesService) {}

  /** Tarjeta, cuenta, cuotas y personas con las que arrancan los formularios. */
  defaults(): Observable<DefaultsFormularios> {
    return this.guardado(
      this.formulariosGuardado,
      () => this.api.get<DefaultsFormularios>('sugerencias/formularios'),
      DEFAULTS_VACIOS,
      (g) => (this.formulariosGuardado = g)
    );
  }

  /** Comercios que ya usaste con lo habitual de cada uno (más usados primero). */
  comercios(): Observable<ComercioHabitual[]> {
    return this.guardado(this.comerciosGuardado, () => this.api.get<ComercioHabitual[]>('sugerencias/comercios'), [], (g) => (this.comerciosGuardado = g));
  }

  /** Olvida lo aprendido (tras registrar algo nuevo, para que la próxima vez cuente). */
  invalidar(): void {
    this.formulariosGuardado = null;
    this.comerciosGuardado = null;
  }

  private guardado<T>(actual: Guardado<T> | null, pedir: () => Observable<T>, alFallar: T, guardar: (g: Guardado<T> | null) => void): Observable<T> {
    if (actual && actual.hasta > this.ahora()) return actual.datos$;
    const datos$ = pedir().pipe(
      tap({ error: () => guardar(null) }), // un fallo no se recuerda: la siguiente vez se intenta de nuevo
      catchError(() => of(alFallar)),
      shareReplay(1)
    );
    guardar({ hasta: this.ahora() + VIGENCIA_SUGERENCIAS_MS, datos$ });
    return datos$;
  }
}
