import { NgModule, Provider, EnvironmentProviders } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';

// Routing
import { AppRoutingModule } from './app-routing.module';

// Root & Auth Components
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';

// Core Interceptors
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { CsrfInterceptor } from './core/interceptors/csrf-interceptor.interceptor';

// Shared Components & Pipes
import { MenuComponent } from './shared/menu/menu.component';
import { ModalComponent } from './shared/modal/modal.component';
import { FormatoFechaPipe } from './pipes/formato-fecha.pipe';
import { FormatoTarjetaPipe } from './pipes/formato-tarjeta.pipe';
import { FormatoPersonaPipe } from './pipes/formato-persona.pipe';

// Dominio: Compras a Crédito
import { TablaComprasCreditoComponent } from './compras-credito/tabla-compras-credito/tabla-compras-credito.component';
import { FormularioComprasCreditoComponent } from './compras-credito/formulario-compras-credito/formulario-compras-credito.component';
import { FormularioCsvComprasComponent } from './compras-credito/formulario-csv-compras/formulario-csv-compras.component';
import { DetalleComprasCreditoComponent } from './compras-credito/detalle-compras-credito/detalle-compras-credito.component';
import { ResponsableCreditoComponent } from './compras-credito/responsable-credito/responsable-credito.component';
import { PagosMesTarjetasComponent } from './compras-credito/pagos-mes-tarjetas/pagos-mes-tarjetas.component';
import { PagosMesTarjetasDetalleComponent } from './compras-credito/pagos-mes-tarjetas-detalle/pagos-mes-tarjetas-detalle.component';
import { BalanceMesComponent } from './compras-credito/balance-mes/balance-mes.component';

// Dominio: Pagos Mensuales
import { PagoPersonaMesComponent } from './pagos-mensuales/pago-persona-mes/pago-persona-mes.component';
import { PagoPersonaMesDetalleComponent } from './pagos-mensuales/pago-persona-mes-detalle/pago-persona-mes-detalle.component';

// Dominio: Préstamos
import { TablaPrestamosComponent } from './prestamos/tabla-prestamos/tabla-prestamos.component';
import { FormularioPrestamosComponent } from './prestamos/formulario-prestamos/formulario-prestamos.component';

/**
 * Agrupación de declaraciones por dominio de la aplicación
 */
const SHARED_DECLARATIONS = [
  MenuComponent,
  ModalComponent,
  FormatoFechaPipe,
  FormatoTarjetaPipe,
  FormatoPersonaPipe
];

const COMPRAS_CREDITO_DECLARATIONS = [
  TablaComprasCreditoComponent,
  FormularioComprasCreditoComponent,
  FormularioCsvComprasComponent,
  DetalleComprasCreditoComponent,
  ResponsableCreditoComponent,
  PagosMesTarjetasComponent,
  PagosMesTarjetasDetalleComponent,
  BalanceMesComponent
];

const PAGOS_MENSUALES_DECLARATIONS = [
  PagoPersonaMesComponent,
  PagoPersonaMesDetalleComponent
];

const PRESTAMOS_DECLARATIONS = [
  TablaPrestamosComponent,
  FormularioPrestamosComponent
];

/**
 * Proveedores y configuración transversal de la aplicación
 */
const CORE_PROVIDERS: (Provider | EnvironmentProviders)[] = [
  DecimalPipe,
  provideAnimations(),
  provideCharts(withDefaultRegisterables()),
  provideHttpClient(
    withInterceptors([
      httpErrorInterceptor, // Outermost: aplica timeout y clasifica errores de red
      authInterceptor       // Añade cabecera Authorization
    ])
  ),
  {
    provide: HTTP_INTERCEPTORS,
    useClass: CsrfInterceptor,
    multi: true
  }
];

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    ...SHARED_DECLARATIONS,
    ...COMPRAS_CREDITO_DECLARATIONS,
    ...PAGOS_MENSUALES_DECLARATIONS,
    ...PRESTAMOS_DECLARATIONS
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatInputModule,
    ReactiveFormsModule,
    FormsModule,
    BaseChartDirective
  ],
  providers: CORE_PROVIDERS,
  bootstrap: [AppComponent]
})
export class AppModule { }

