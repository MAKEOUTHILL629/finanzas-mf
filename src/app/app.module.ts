import { NgModule, Provider, EnvironmentProviders } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { DecimalPipe } from '@angular/common';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

// Routing
import { AppRoutingModule } from './app-routing.module';

// Root, shell & auth
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { MenuComponent } from './shared/menu/menu.component';
import { ToastComponent } from './shared/toast/toast.component';
import { AppLayoutComponent } from './shared/ui/layout/app-layout.component';
import { SharedModule } from './shared/shared.module';

// Core Interceptors
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { catalogosInterceptor } from './core/interceptors/catalogos.interceptor';
import { deduplicarGetInterceptor } from './core/interceptors/deduplicar-get.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { CsrfInterceptor } from './core/interceptors/csrf-interceptor.interceptor';

/**
 * Proveedores y configuración transversal de la aplicación
 */
const CORE_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  DecimalPipe,
  provideAnimations(),
  provideHttpClient(
    withInterceptors([
      httpErrorInterceptor, // Outermost: aplica timeout y clasifica errores de red
      authInterceptor,      // Añade cabecera Authorization
      deduplicarGetInterceptor, // Dos lecturas idénticas simultáneas comparten una sola petición
      catalogosInterceptor  // Refresca los selectores cuando una operación cambia cuentas, tarjetas, personas o categorías
    ])
  ),
  {
    provide: HTTP_INTERCEPTORS,
    useClass: CsrfInterceptor,
    multi: true
  }
];

/**
 * Raíz de la aplicación: solo el armazón (menú, avisos, estructura de página) y el inicio de sesión. Todas las pantallas viven en
 * módulos de funcionalidad que se descargan al entrar en su ruta (ver `app-routing.module.ts`), así el paquete inicial es mínimo.
 */
@NgModule({
  declarations: [AppComponent, LoginComponent, AppLayoutComponent, MenuComponent, ToastComponent],
  imports: [BrowserModule, AppRoutingModule, SharedModule],
  providers: CORE_PROVIDERS,
  bootstrap: [AppComponent]
})
export class AppModule { }
