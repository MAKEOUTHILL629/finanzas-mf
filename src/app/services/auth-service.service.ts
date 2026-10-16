import { limpiarCachesDeSesion } from '../core/cache-sesion';
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { ApiServicesService } from './api-services.service';
import { CatalogosService } from './catalogos.service';
import { Credentials, AuthResponse } from '../modelos/Authenticate';
import { clearAllFilterStates } from '../shared/table-filter.helper';

@Injectable({
  providedIn: 'root'
})
export class AuthServiceService {

   // URL base de tu API. Ajusta según sea necesario.
  // Si usas el proxy de Angular (proxy.conf.json), puedes usar una ruta relativa.

  // private apiUrl = 'http://localhost:9000/api/auth'; // Ejemplo sin proxy (ajusta puerto si es necesario)

  // Clave para guardar el token en localStorage
  private readonly TOKEN_KEY = 'authToken';

  // BehaviorSubject para manejar el estado de autenticación reactivamente
  // Inicializa verificando si ya existe un token al cargar la app
  private loggedIn = new BehaviorSubject<boolean>(this.hasToken());

  // Observable público para que otros componentes/servicios se suscriban al estado de autenticación
  public isLoggedIn$ = this.loggedIn.asObservable();

  constructor(
    private apiService: ApiServicesService,
    private router: Router,
    private catalogos: CatalogosService
  ) { }

  /**
   * Decodifica el payload del JWT y comprueba si ya expiró (sin red).
   * @returns true si el token está expirado o es malformado.
   */
  private isTokenExpired(): boolean {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return true;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return false; // Sin claim exp → no expira
      return payload.exp * 1000 < Date.now();
    } catch {
      return true; // token malformado → tratar como expirado
    }
  }

  /**
   * Verifica si existe un token almacenado Y no ha expirado localmente.
   * @returns boolean
   */
  private hasToken(): boolean {
    if (!localStorage.getItem(this.TOKEN_KEY)) return false;
    if (this.isTokenExpired()) {
      localStorage.removeItem(this.TOKEN_KEY);
      return false;
    }
    return true;
  }

  /**
   * Realiza la petición de login al backend.
   * @param credentials - Objeto con email y password.
   * @returns Observable con la respuesta del backend (o un error).
   */
  login(credentials: Credentials): Observable<AuthResponse> {
    const loginUrl = `auth/login`;
    return this.apiService.post<AuthResponse>(loginUrl, credentials)
      .pipe(
        tap(response => {
          if (response && response.token) {
             this.catalogos.limpiar(); // sesión nueva = catálogos nuevos
             limpiarCachesDeSesion();
             localStorage.setItem(this.TOKEN_KEY, response.token);
             this.loggedIn.next(true);
          } else {
            this.loggedIn.next(false);
            throw new Error('No token received in response');
          }
        }),
        catchError((error) => throwError(() => error)) // Preserva el error original
      );
  }


  /**
   * Obtiene el token JWT almacenado.
   * @returns string | null - El token o null si no existe.
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Verifica si el usuario está actualmente autenticado (basado en el estado interno).
   * IMPORTANTE: Para proteger rutas, usa el Observable isLoggedIn$ o un AuthGuard.
   * Esta función síncrona puede no reflejar el estado más reciente si se llama
   * antes de que se complete una operación asíncrona.
   * @returns boolean
   */
  isAuthenticated()  {

    // Sin token (o ya vencido según su `exp`, hasToken() lo descarta) no hace falta preguntarle al backend:
    // respondería 401 y ensuciaría la consola en cada carga y cada navegación protegida.
    if (!this.hasToken()) {
      this.loggedIn.next(false);
      return of(false);
    }

   return  this.apiService.get<{ status?: string }>('auth/token-is-valid')
      .pipe(
        tap((response: { status?: string }) => {
          if (response && response.status === 'ok') {
            this.loggedIn.next(true);
          } else {
            this.loggedIn.next(false);
            localStorage.removeItem(this.TOKEN_KEY);
          }
        }),
        catchError((error: HttpErrorResponse) => {
          // 401 = el backend rechazó ESTE token (firma de otro entorno, usuario inexistente, vencido): la sesión no sirve
          // y hay que descartarla; si no, cada navegación repite la petición y el 401 para siempre.
          if (error?.status === 401) {
            localStorage.removeItem(this.TOKEN_KEY);
            this.loggedIn.next(false);
          }
          // Si la red falla (status 0) o el servidor da un 5xx, no desloguear: puede ser un error transitorio.
          // Si el token está expirado localmente, ya lo maneja hasToken() en el arranque.
          return of(false);
        })
      );
  }


  /**
   * Manejador básico de errores HTTP.
   * @param error - El objeto HttpErrorResponse.
   * @returns Observable que emite el error.
   */
  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }


  logout(): void {
    const logoutUrl = `auth/logout`;

    this.apiService.post(logoutUrl, {})
      .pipe(
        catchError(() => of(null)),
        finalize(() => {
          clearAllFilterStates();
          // Los catálogos (personas, cuentas…) son de ESTE usuario: no deben verse en la sesión de otro.
          this.catalogos.limpiar();
          limpiarCachesDeSesion();
          localStorage.removeItem(this.TOKEN_KEY);
          this.loggedIn.next(false);
          this.router.navigate(['/login']);
        })
      )
      .subscribe();
  }
}
