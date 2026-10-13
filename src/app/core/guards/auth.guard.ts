import { inject } from '@angular/core'; // Importa inject
import { CanActivateFn, Router, UrlTree } from '@angular/router'; // Importa tipos necesarios
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthServiceService } from '../../services/auth-service.service';

// Importa tu servicio de autenticación

/**
 * Guardia de ruta funcional para verificar si el usuario está autenticado.
 * Si el usuario está autenticado, permite el acceso a la ruta.
 * Si no está autenticado, redirige a la página de login.
 *
 * @param route - La instantánea de la ruta activada.
 * @param state - El estado futuro del router.
 * @returns Observable<boolean | UrlTree> | boolean | UrlTree -
 * True si se permite la activación, UrlTree para redirigir.
 */
export const authGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> | boolean | UrlTree => {

  // Inyecta AuthService y Router DENTRO de la función
  const authService = inject(AuthServiceService);
  const router = inject(Router);
  return authService.isAuthenticated().pipe // Asegúrate de que el servicio esté inicializado
  // Usamos el Observable isLoggedIn$ de AuthService para una verificación reactiva
   (
    take(1), // Tomamos solo el último valor emitido para que el Observable complete
    map(isLoggedIn => {
        if (isLoggedIn) {
          return true;
        } else {
          return router.createUrlTree(['/login']);
        }
      })
  );
};
