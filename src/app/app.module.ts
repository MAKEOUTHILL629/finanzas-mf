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
import { catalogosInterceptor } from './core/interceptors/catalogos.interceptor';
import { httpErrorInterceptor } from './core/interceptors/http-error.interceptor';
import { CsrfInterceptor } from './core/interceptors/csrf-interceptor.interceptor';

// Shared Components & Pipes
import { MenuComponent } from './shared/menu/menu.component';
import { ModalComponent } from './shared/modal/modal.component';
import { SelectComponent } from './shared/ui/select/select.component';
import { FormatoFechaPipe } from './pipes/formato-fecha.pipe';
import { FormatoTarjetaPipe } from './pipes/formato-tarjeta.pipe';
import { FormatoPersonaPipe } from './pipes/formato-persona.pipe';
import { FormatoMonedaPipe } from './pipes/formato-moneda.pipe';
import { FormatoFechaCortaPipe } from './pipes/formato-fecha-corta.pipe';
import { ToastComponent } from './shared/toast/toast.component';

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
import { DetallePrestamoComponent } from './prestamos/detalle-prestamo/detalle-prestamo.component';
import { FormularioEditarPrestamoComponent } from './prestamos/formulario-editar-prestamo/formulario-editar-prestamo.component';
import { ListaCortesComponent } from './prestamos/lista-cortes/lista-cortes.component';
import { FormularioCorteComponent } from './prestamos/formulario-corte/formulario-corte.component';

// Dominio: Obligaciones del mes
import { ListaObligacionesComponent } from './obligaciones/lista-obligaciones/lista-obligaciones.component';
import { FormularioObligacionComponent } from './obligaciones/formulario-obligacion/formulario-obligacion.component';
import { DetalleObligacionComponent } from './obligaciones/detalle-obligacion/detalle-obligacion.component';
import { FormularioAportesComponent } from './obligaciones/formulario-aportes/formulario-aportes.component';

// Dominio: Extractos de tarjetas
import { ExtractosTarjetasComponent } from './extractos/extractos-tarjetas/extractos-tarjetas.component';
import { FormularioPagarExtractoComponent } from './extractos/formulario-pagar-extracto/formulario-pagar-extracto.component';

// Dominio: Tarjetas (configuración)
import { ListaTarjetasComponent } from './tarjetas/lista-tarjetas/lista-tarjetas.component';
import { FormularioTarjetaComponent } from './tarjetas/formulario-tarjeta/formulario-tarjeta.component';
import { FormularioPlasticoComponent } from './tarjetas/formulario-plastico/formulario-plastico.component';
import { HistorialTarjetaComponent } from './tarjetas/historial-tarjeta/historial-tarjeta.component';

// Dominio: Cuentas y categorías
import { ListaCuentasComponent } from './cuentas/lista-cuentas/lista-cuentas.component';
import { FormularioCuentaComponent } from './cuentas/formulario-cuenta/formulario-cuenta.component';
import { ListaCategoriasComponent } from './cuentas/lista-categorias/lista-categorias.component';
import { FormularioCategoriaComponent } from './cuentas/formulario-categoria/formulario-categoria.component';

// Dominio: Transacciones
import { ListaTransaccionesComponent } from './transacciones/lista-transacciones/lista-transacciones.component';
import { FormularioTransaccionComponent } from './transacciones/formulario-transaccion/formulario-transaccion.component';

// Dominio: Correos del banco
import { ListaCorreosComponent } from './correos/lista-correos/lista-correos.component';
import { FormularioConciliarComponent } from './correos/formulario-conciliar/formulario-conciliar.component';
import { ProductosDetectadosComponent } from './correos/productos-detectados/productos-detectados.component';
import { ReprocesarCorreosComponent } from './correos/reprocesar-correos/reprocesar-correos.component';
import { CobrosComponent } from './cobros/cobros.component';
import { FormularioCobroComponent } from './cobros/formulario-cobro/formulario-cobro.component';
import { AprobarReporteComponent } from './cobros/aprobar-reporte/aprobar-reporte.component';
import { CompartirCobroComponent } from './cobros/compartir-cobro/compartir-cobro.component';
import { CobroPublicoComponent } from './cobros/cobro-publico/cobro-publico.component';

// Dominio: Personas (lo que debe cada una)
import { ListaPersonasComponent } from './personas/lista-personas/lista-personas.component';
import { DetallePersonaComponent } from './personas/detalle-persona/detalle-persona.component';
// Dominio: Flujo de caja y deudas por persona
import { FlujoCajaComponent } from './flujo-caja/flujo-caja.component';
import { EstadoCuentaComponent } from './deudas/estado-cuenta/estado-cuenta.component';
// Dominio: Aportes del carro, liquidación de fin de mes y recurrentes por persona
import { AportesCarroComponent } from './aportes-carro/aportes-carro.component';
import { FormularioAporteDiarioComponent } from './aportes-carro/formulario-aporte-diario/formulario-aporte-diario.component';
import { FormularioPeriodoCarroComponent } from './aportes-carro/formulario-periodo-carro/formulario-periodo-carro.component';
import { FormularioExcedenteComponent } from './aportes-carro/formulario-excedente/formulario-excedente.component';
import { LiquidacionMensualComponent } from './liquidacion/liquidacion-mensual.component';
import { ListaRecurrentesPersonaComponent } from './recurrentes-persona/lista-recurrentes-persona/lista-recurrentes-persona.component';
import { FormularioRecurrentePersonaComponent } from './recurrentes-persona/formulario-recurrente-persona/formulario-recurrente-persona.component';
import { FormularioAbonoComponent } from './deudas/formulario-abono/formulario-abono.component';
import { ListaCrucesComponent } from './deudas/lista-cruces/lista-cruces.component';
import { FormularioCruceComponent } from './deudas/formulario-cruce/formulario-cruce.component';

/**
 * Agrupación de declaraciones por dominio de la aplicación
 */
const SHARED_DECLARATIONS = [
  MenuComponent,
  ModalComponent,
  SelectComponent,
  FormatoFechaPipe,
  FormatoTarjetaPipe,
  FormatoPersonaPipe,
  FormatoMonedaPipe,
  FormatoFechaCortaPipe,
  ToastComponent
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
  FormularioPrestamosComponent,
  DetallePrestamoComponent,
  FormularioEditarPrestamoComponent,
  ListaCortesComponent,
  FormularioCorteComponent
];

const OBLIGACIONES_DECLARATIONS = [
  ListaObligacionesComponent,
  FormularioObligacionComponent,
  DetalleObligacionComponent,
  FormularioAportesComponent
];

const EXTRACTOS_DECLARATIONS = [
  ExtractosTarjetasComponent,
  FormularioPagarExtractoComponent
];

const TARJETAS_DECLARATIONS = [
  ListaTarjetasComponent,
  FormularioTarjetaComponent,
  FormularioPlasticoComponent,
  HistorialTarjetaComponent
];

const CUENTAS_DECLARATIONS = [
  ListaCuentasComponent,
  FormularioCuentaComponent,
  ListaCategoriasComponent,
  FormularioCategoriaComponent
];

const TRANSACCIONES_DECLARATIONS = [
  ListaTransaccionesComponent,
  FormularioTransaccionComponent
];

const CORREOS_DECLARATIONS = [
  ListaCorreosComponent,
  FormularioConciliarComponent,
  ProductosDetectadosComponent,
  ReprocesarCorreosComponent
];

const COBROS_DECLARATIONS = [
  CobrosComponent,
  FormularioCobroComponent,
  AprobarReporteComponent,
  CompartirCobroComponent,
  CobroPublicoComponent
];

const PERSONAS_DECLARATIONS = [
  ListaPersonasComponent,
  DetallePersonaComponent
];

const ANALISIS_DECLARATIONS = [
  FlujoCajaComponent,
  EstadoCuentaComponent,
  AportesCarroComponent,
  FormularioAporteDiarioComponent,
  FormularioPeriodoCarroComponent,
  FormularioExcedenteComponent,
  LiquidacionMensualComponent,
  ListaRecurrentesPersonaComponent,
  FormularioRecurrentePersonaComponent,
  FormularioAbonoComponent,
  ListaCrucesComponent,
  FormularioCruceComponent
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
      authInterceptor,      // Añade cabecera Authorization
      catalogosInterceptor  // Refresca los selectores cuando una operación cambia cuentas, tarjetas, personas o categorías
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
    ...PRESTAMOS_DECLARATIONS,
    ...OBLIGACIONES_DECLARATIONS,
    ...EXTRACTOS_DECLARATIONS,
    ...TARJETAS_DECLARATIONS,
    ...CUENTAS_DECLARATIONS,
    ...TRANSACCIONES_DECLARATIONS,
    ...CORREOS_DECLARATIONS,
    ...COBROS_DECLARATIONS,
    ...PERSONAS_DECLARATIONS,
    ...ANALISIS_DECLARATIONS
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

