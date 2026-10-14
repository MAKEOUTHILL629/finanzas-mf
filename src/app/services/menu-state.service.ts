import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { GRUPOS_MENU } from '../shared/menu/menu.config';
import { ResultadoFavorito, alternarFavorito, resolverFavoritos } from '../shared/menu/menu.helpers';
import { AuthServiceService } from './auth-service.service';

/**
 * Cómo se presenta la navegación según el ancho y la sesión:
 *  - `invitado`: sin sesión no hay menú (solo el cambio de tema).
 *  - `sidebar`: barra lateral completa (≥ 1024 px).
 *  - `rail`: barra lateral compacta, solo íconos (≥ 1024 px, la persona la colapsó).
 *  - `drawer`: barra superior + panel deslizable (768–1023 px).
 *  - `movil`: barra superior + panel deslizable + barra inferior con los favoritos (< 768 px).
 */
export type LayoutMenu = 'invitado' | 'sidebar' | 'rail' | 'drawer' | 'movil';

export const BP_ESCRITORIO = 1024;
export const BP_MOVIL = 768;

export function layoutPara(ancho: number, colapsado: boolean, conSesion: boolean): LayoutMenu {
  if (!conSesion) return 'invitado';
  if (ancho >= BP_ESCRITORIO) return colapsado ? 'rail' : 'sidebar';
  return ancho >= BP_MOVIL ? 'drawer' : 'movil';
}

const CLAVE_COLAPSADO = 'finanzas-menu-colapsado';
const CLAVE_FAVORITOS = 'finanzas-menu-favoritos';

function leer(clave: string): unknown {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo === null ? undefined : JSON.parse(crudo);
  } catch {
    return undefined; // sin almacenamiento o valor corrupto: se usan los valores por defecto
  }
}

function guardar(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento (modo privado): la preferencia vale solo para esta sesión */
  }
}

/**
 * Estado de la navegación compartido entre el menú y el layout de la aplicación: ancho de pantalla, barra colapsada,
 * panel abierto y favoritos. Vive en un servicio (y no en el componente) para que el layout lo lea de forma
 * síncrona antes del primer render, sin el error `ExpressionChangedAfterItHasBeenChecked`.
 */
@Injectable({ providedIn: 'root' })
export class MenuStateService implements OnDestroy {
  private readonly ancho$ = new BehaviorSubject<number>(typeof window === 'undefined' ? BP_ESCRITORIO : window.innerWidth);
  readonly colapsado$ = new BehaviorSubject<boolean>(leer(CLAVE_COLAPSADO) === true);
  readonly drawerAbierto$ = new BehaviorSubject<boolean>(false);
  readonly favoritos$ = new BehaviorSubject<string[]>(resolverFavoritos(leer(CLAVE_FAVORITOS), GRUPOS_MENU));

  readonly layout$: Observable<LayoutMenu>;

  private readonly alCambiarTamano = () => this.fijarAncho(window.innerWidth);

  constructor(auth: AuthServiceService) {
    this.layout$ = combineLatest([this.ancho$, this.colapsado$, auth.isLoggedIn$]).pipe(
      map(([ancho, colapsado, sesion]) => layoutPara(ancho, colapsado, sesion)),
      distinctUntilChanged()
    );
    // el panel deslizable solo existe en pantallas chicas: al pasar a escritorio (o cerrar sesión) se cierra
    this.layout$.subscribe((l) => {
      if ((l === 'sidebar' || l === 'rail' || l === 'invitado') && this.drawerAbierto$.value) this.drawerAbierto$.next(false);
    });
    if (typeof window !== 'undefined') window.addEventListener('resize', this.alCambiarTamano);
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.alCambiarTamano);
  }

  fijarAncho(ancho: number): void {
    this.ancho$.next(ancho);
  }

  // ── barra lateral ──

  alternarColapsado(): void {
    this.fijarColapsado(!this.colapsado$.value);
  }

  fijarColapsado(valor: boolean): void {
    this.colapsado$.next(valor);
    guardar(CLAVE_COLAPSADO, valor);
  }

  // ── panel deslizable (tablet y móvil) ──

  abrirDrawer(): void {
    this.drawerAbierto$.next(true);
  }

  cerrarDrawer(): void {
    if (this.drawerAbierto$.value) this.drawerAbierto$.next(false);
  }

  // ── favoritos ──

  /** Fija o desfija un acceso. Devuelve `lleno` si se intentó fijar con los 4 huecos ocupados. */
  alternarFavorito(id: string): ResultadoFavorito {
    const r = alternarFavorito(this.favoritos$.value, id);
    if (r.favoritos !== this.favoritos$.value) {
      this.favoritos$.next(r.favoritos);
      guardar(CLAVE_FAVORITOS, r.favoritos);
    }
    return r;
  }
}
