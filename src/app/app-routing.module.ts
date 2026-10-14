import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TablaComprasCreditoComponent } from './compras-credito/tabla-compras-credito/tabla-compras-credito.component';
import { DetalleComprasCreditoComponent } from './compras-credito/detalle-compras-credito/detalle-compras-credito.component';
import { TablaPrestamosComponent } from './prestamos/tabla-prestamos/tabla-prestamos.component';
import { PagosMesTarjetasComponent } from './compras-credito/pagos-mes-tarjetas/pagos-mes-tarjetas.component';
import { PagoPersonaMesComponent } from './pagos-mensuales/pago-persona-mes/pago-persona-mes.component';
import { PagoPersonaMesDetalleComponent } from './pagos-mensuales/pago-persona-mes-detalle/pago-persona-mes-detalle.component';
import { PagosMesTarjetasDetalleComponent } from './compras-credito/pagos-mes-tarjetas-detalle/pagos-mes-tarjetas-detalle.component';
import { LoginComponent } from './login/login.component';
import { ListaObligacionesComponent } from './obligaciones/lista-obligaciones/lista-obligaciones.component';
import { DetalleObligacionComponent } from './obligaciones/detalle-obligacion/detalle-obligacion.component';
import { ExtractosTarjetasComponent } from './extractos/extractos-tarjetas/extractos-tarjetas.component';
import { DetallePrestamoComponent } from './prestamos/detalle-prestamo/detalle-prestamo.component';
import { ListaCortesComponent } from './prestamos/lista-cortes/lista-cortes.component';
import { ListaTarjetasComponent } from './tarjetas/lista-tarjetas/lista-tarjetas.component';
import { ListaCuentasComponent } from './cuentas/lista-cuentas/lista-cuentas.component';
import { ListaCategoriasComponent } from './cuentas/lista-categorias/lista-categorias.component';
import { ListaTransaccionesComponent } from './transacciones/lista-transacciones/lista-transacciones.component';
import { ListaCorreosComponent } from './correos/lista-correos/lista-correos.component';
import { FlujoCajaComponent } from './flujo-caja/flujo-caja.component';
import { EstadoCuentaComponent } from './deudas/estado-cuenta/estado-cuenta.component';
import { ListaCrucesComponent } from './deudas/lista-cruces/lista-cruces.component';
import { authGuard } from './core/guards/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'compras-credito', component: TablaComprasCreditoComponent, canActivate: [authGuard] },
  {
    path: 'compra-credito-detalle/:id',
    component: DetalleComprasCreditoComponent,
    canActivate: [authGuard]
  },
  { path: 'prestamos', component: TablaPrestamosComponent, canActivate: [authGuard] },
  { path: 'prestamos/:id', component: DetallePrestamoComponent, canActivate: [authGuard] },
  { path: 'cortes-cobro', component: ListaCortesComponent, canActivate: [authGuard] },
  { path: 'pagos-mes', component: PagosMesTarjetasComponent, canActivate: [authGuard] },
  { path: 'pagos-mes-personas', component: PagoPersonaMesComponent, canActivate: [authGuard] },
  { path: 'pagos-mes-personas-detalle/:id', component: PagoPersonaMesDetalleComponent, canActivate: [authGuard] },
  { path: 'pagos-mes/:id', component: PagosMesTarjetasDetalleComponent, canActivate: [authGuard] },
  { path: 'tarjetas', component: ListaTarjetasComponent, canActivate: [authGuard] },
  { path: 'extractos', component: ExtractosTarjetasComponent, canActivate: [authGuard] },
  { path: 'cuentas', component: ListaCuentasComponent, canActivate: [authGuard] },
  { path: 'categorias', component: ListaCategoriasComponent, canActivate: [authGuard] },
  { path: 'transacciones', component: ListaTransaccionesComponent, canActivate: [authGuard] },
  { path: 'correos', component: ListaCorreosComponent, canActivate: [authGuard] },
  { path: 'flujo-caja', component: FlujoCajaComponent, canActivate: [authGuard] },
  { path: 'estado-cuenta', component: EstadoCuentaComponent, canActivate: [authGuard] },
  { path: 'cruces-deuda', component: ListaCrucesComponent, canActivate: [authGuard] },
  { path: 'obligaciones', component: ListaObligacionesComponent, canActivate: [authGuard] },
  { path: 'obligaciones/:id', component: DetalleObligacionComponent, canActivate: [authGuard] },
  { path: '', redirectTo: 'compras-credito', pathMatch: 'full' },
  { path: '**', redirectTo: 'compras-credito' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
