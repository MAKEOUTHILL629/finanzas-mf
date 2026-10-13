import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core'; // Importa inject
import { Observable } from 'rxjs';

// Importa tu servicio de autenticación
// <-- Ajusta la ruta a tu AuthService
import { AuthServiceService } from '../../services/auth-service.service';

export const authInterceptor: HttpInterceptorFn = (
    req: HttpRequest<unknown>,
    next: HttpHandlerFn
  ): Observable<HttpEvent<unknown>> => {

  const authService = inject(AuthServiceService);
  const authToken = authService.getToken();

  if (authToken) {
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${authToken}` }
    });
    return next(authReq);
  }

  return next(req);
};
