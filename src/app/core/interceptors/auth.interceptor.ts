import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core'; // Importa inject
import { Observable } from 'rxjs';

// Importa tu servicio de autenticación
// <-- Ajusta la ruta a tu AuthService
import { AuthServiceService } from '../../services/auth-service.service';

export const authInterceptor: HttpInterceptorFn = (
    req: HttpRequest<unknown>,
    next: HttpHandlerFn // Nota que es HttpHandlerFn, no HttpHandler
  ): Observable<HttpEvent<unknown>> => {

  // Inyecta AuthService DENTRO de la función usando inject()
  const authService = inject(AuthServiceService);

  // --- Inicio del Log ---
  console.log(`%c[AuthInterceptorFn] Interceptando Petición: ${req.method} ${req.url}`, 'color: purple; font-weight: bold;');

  // 1. Obtener el token
  const authToken = authService.getToken();

  // 2. Verificar si hay token
  if (authToken) {
    console.log('%c[AuthInterceptorFn] Token encontrado. Añadiendo cabecera Authorization.', 'color: green;');

    // 3. Clonar la petición y añadir la cabecera
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${authToken}`
      }
    });

    // --- Log de la Petición Modificada ---
    console.log('%c[AuthInterceptorFn] Petición Final Enviada:', 'color: green; font-weight: bold;',);
    console.log(`  -> URL: ${authReq.url}`);
    console.log(`  -> Método: ${authReq.method}`);
    const headerKeys = authReq.headers.keys();
    const headersObj: { [key: string]: string | null } = {};
    headerKeys.forEach(key => { headersObj[key] = authReq.headers.get(key); });
    console.log('  -> Cabeceras:', headersObj);

    // 4. Pasar la petición MODIFICADA al siguiente manejador
    return next(authReq); // Llama a next() con la petición clonada

  } else {
    // --- Log si no se añade token ---
    console.log('%c[AuthInterceptorFn] No se encontró token. Enviando petición original.', 'color: orange;');
    console.log(`  -> URL: ${req.url}`);
    console.log(`  -> Método: ${req.method}`);
    const headerKeys = req.headers.keys();
    const headersObj: { [key: string]: string | null } = {};
    headerKeys.forEach(key => { headersObj[key] = req.headers.get(key); });
    console.log('  -> Cabeceras Originales:', headersObj);

    // 5. Pasar la petición ORIGINAL al siguiente manejador
    return next(req); // Llama a next() con la petición original
  }
};
