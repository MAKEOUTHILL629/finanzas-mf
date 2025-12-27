import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { ApiServicesService } from '../servicios/api-services.service';
import { Credentials, AuthResponse } from '../modelos/Authenticate';

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
    private router: Router
  ) { }

  /**
   * Verifica si existe un token almacenado.
   * @returns boolean - True si hay token, false si no.
   */
  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
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
          // Side effect: Si el login es exitoso (asumimos que token existe si no hay error)
          // Guardar el token y actualizar el estado de autenticación.
          if (response && response.token) {
             localStorage.setItem(this.TOKEN_KEY, response.token);
             this.loggedIn.next(true); // Notificar que el usuario está logueado
             console.log('Token stored successfully.');
          } else {
            // Esto no debería pasar si el backend devuelve 200 OK solo con token,
            // pero es una comprobación extra.
            console.error('Login response ok but no token received:', response);
            this.loggedIn.next(false);
            // Podrías lanzar un error aquí si quieres manejarlo como fallo
             throw new Error('No token received in response');
          }
        }),
        catchError(this.handleError) // Manejar errores HTTP
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

   return  this.apiService.get<{ status?: string }>('auth/token-is-valid') // Llamada opcional al backend para verificar el estado
      .pipe(
        tap((response: { status?: string }) => {
          console.log('Token validity check response:', response);
          // Si la respuesta indica que el token es válido, actualiza el estado
          if (response && response.status === 'ok') {
            this.loggedIn.next(true);
          } else {
            this.loggedIn.next(false);
            localStorage.removeItem(this.TOKEN_KEY); // Limpia el token si no es válido
          }
        }),
        catchError(err => {
          console.error('Error checking token validity:', err);
          this.loggedIn.next(false); // Si falla la verificación, asumimos que no está autenticado
          return of(false); // Retorna un observable con false
        })
      ); // Necesario para que la llamada se ejecute

    // Devuelve el valor actual del BehaviorSubject
  }


  /**
   * Manejador básico de errores HTTP.
   * @param error - El objeto HttpErrorResponse.
   * @returns Observable que emite el error.
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ocurrió un error desconocido.';
    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente o de red.
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // El backend devolvió un código de error.
      // El cuerpo de la respuesta puede contener pistas sobre qué salió mal.
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error && typeof error.error === 'object' && error.error.message) {
         errorMessage = `Error: ${error.error.message}`; // Usar mensaje del backend si está disponible
      }
    }
    console.error('AuthService Error:', errorMessage, error);
    // Devolver un observable con un error user-facing.
    // El componente que llama puede usar este mensaje.
    return throwError(() => new Error(errorMessage));
  }


  // En AuthService (Ejemplo opcional de llamada al backend logout)
logout(): void {
  const logoutUrl = `auth/logout`;

  // Llamada opcional al backend antes de limpiar localmente
  // Solo si necesitas la lógica del backend (logging, blocklist)
  this.apiService.post(logoutUrl, {}) // Enviar POST vacío o como lo requiera tu API
    .pipe(
      catchError(err => {
        // Incluso si falla la llamada al backend (ej. red),
        // probablemente quieras desloguear al usuario localmente.
        console.error('Backend logout call failed, proceeding with local logout', err);
        return of(null); // Continúa con el logout local
      }),
      finalize(() => {
        // Esta parte SIEMPRE se ejecuta (después de la llamada HTTP o si falló)
        localStorage.removeItem(this.TOKEN_KEY);
        this.loggedIn.next(false);
        this.router.navigate(['/login']);
        console.log('User logged out locally.');
      })
    )
    .subscribe(); // Necesitas suscribirte para que la llamada se ejecute

  // *** Versión simple (sin llamada al backend): ***
  // localStorage.removeItem(this.TOKEN_KEY);
  // this.loggedIn.next(false);
  // this.router.navigate(['/login']);
  // console.log('User logged out locally.');
}
}
