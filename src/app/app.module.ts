import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { TablaComprasCreditoComponent } from './compras-credito/tabla-compras-credito/tabla-compras-credito.component';
import { FormularioComprasCreditoComponent } from './compras-credito/formulario-compras-credito/formulario-compras-credito.component';
import { FormularioCsvComprasComponent } from './compras-credito/formulario-csv-compras/formulario-csv-compras.component';

import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptors } from '@angular/common/http';


import { provideAnimations } from '@angular/platform-browser/animations';
import { FormatoFechaPipe } from './pipes/formato-fecha.pipe';
import { DetalleComprasCreditoComponent } from './compras-credito/detalle-compras-credito/detalle-compras-credito.component';
import { ResponsableCreditoComponent } from './compras-credito/responsable-credito/responsable-credito.component';
import { MenuComponent } from './shared/menu/menu.component';
import { TablaPrestamosComponent } from './prestamos/tabla-prestamos/tabla-prestamos.component';
import { FormularioPrestamosComponent } from './prestamos/formulario-prestamos/formulario-prestamos.component';
import { ModalComponent } from './shared/modal/modal.component';
import { PagosMesTarjetasComponent } from './compras-credito/pagos-mes-tarjetas/pagos-mes-tarjetas.component';
import { BaseChartDirective, provideCharts, withDefaultRegisterables   } from 'ng2-charts';
import { CsrfInterceptor } from './core/interceptors/csrf-interceptor.interceptor';
import { PagoPersonaMesComponent } from './pagos-mensuales/pago-persona-mes/pago-persona-mes.component';
import { PagoPersonaMesDetalleComponent } from './pagos-mensuales/pago-persona-mes-detalle/pago-persona-mes-detalle.component';
import { FormatoTarjetaPipe } from './pipes/formato-tarjeta.pipe';
import { FormatoPersonaPipe } from './pipes/formato-persona.pipe';
import { PagosMesTarjetasDetalleComponent } from './compras-credito/pagos-mes-tarjetas-detalle/pagos-mes-tarjetas-detalle.component';
import { LoginComponent } from './login/login.component';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecimalPipe } from '@angular/common';
import { BalanceMesComponent } from './compras-credito/balance-mes/balance-mes.component';


@NgModule({
  declarations: [
    AppComponent,
    TablaComprasCreditoComponent,
    FormularioComprasCreditoComponent,
    FormularioCsvComprasComponent,
    FormatoFechaPipe,
    DetalleComprasCreditoComponent,
    ResponsableCreditoComponent,
    MenuComponent,
    TablaPrestamosComponent,
    FormularioPrestamosComponent,
    ModalComponent,
    PagosMesTarjetasComponent,
    PagoPersonaMesComponent,
    PagoPersonaMesDetalleComponent,
    FormatoTarjetaPipe,
    FormatoPersonaPipe,
    PagosMesTarjetasDetalleComponent,
    LoginComponent,
    BalanceMesComponent,

  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatInputModule,
    ReactiveFormsModule,
    FormsModule,
    BaseChartDirective,

  ],
  providers: [provideHttpClient(withInterceptors([
    httpErrorInterceptor, // Outermost: aplica timeout y clasifica errores de red
    authInterceptor       // Añade cabecera Authorization
])),DecimalPipe, provideAnimations(), provideCharts(withDefaultRegisterables()),  { provide: HTTP_INTERCEPTORS, useClass: CsrfInterceptor, multi: true }],
  bootstrap: [AppComponent]
})
export class AppModule { }
