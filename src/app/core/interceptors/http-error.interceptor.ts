import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';

/** Tiempo máximo de espera por respuesta del backend (ms) */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Interceptor funcional que aplica un timeout global a todas las peticiones HTTP
 * y clasifica los errores de red/timeout para facilitar su manejo en componentes.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  return next(req).pipe(
    timeout(REQUEST_TIMEOUT_MS),
    catchError((error: unknown) => {
      // Timeout de la petición
      if (error instanceof TimeoutError) {
        const timeoutError = new HttpErrorResponse({
          error: { message: 'La petición superó el tiempo de espera.' },
          status: 0,
          statusText: 'Timeout',
          url: req.url
        });
        return throwError(() => ({ ...timeoutError, isTimeout: true }));
      }

      // Error de red (sin conexión o servidor inaccesible): status === 0
      if (error instanceof HttpErrorResponse && error.status === 0) {
        return throwError(() => ({ ...error, isNetworkError: true }));
      }

      // Resto de errores HTTP (4xx, 5xx) — se re-lanzan tal cual
      return throwError(() => error);
    })
  );
};
