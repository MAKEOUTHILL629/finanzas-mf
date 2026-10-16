import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PrecargaInteligente } from './core/precarga-inteligente.strategy';
import { LoginComponent } from './login/login.component';

/**
 * Todas las pantallas se cargan de forma diferida: el navegador solo descarga el armazón y el inicio de sesión, y trae el paquete de
 * cada sección cuando se entra en ella (y, con la red libre, el resto en segundo plano: ver `PrecargaInteligente`).
 * Cada módulo de funcionalidad exporta sus rutas (con la guardia de sesión) junto a sus componentes.
 */
export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  // Página pública del enlace de cobro: la abre la persona a la que se le cobra, sin iniciar sesión (sin guard y sin menú).
  { path: 'p', loadChildren: () => import('./cobros/cobro-publico.module').then((m) => m.RUTAS_COBRO_PUBLICO) },

  { path: 'compras-credito', loadChildren: () => import('./compras-credito/compras-credito.module').then((m) => m.RUTAS_COMPRAS) },
  { path: 'compra-credito-detalle', loadChildren: () => import('./compras-credito/compras-credito.module').then((m) => m.RUTAS_COMPRA_DETALLE) },
  { path: 'pagos-mes', loadChildren: () => import('./compras-credito/compras-credito.module').then((m) => m.RUTAS_PAGOS_MES) },
  { path: 'pagos-mes-personas', loadChildren: () => import('./pagos-mensuales/pagos-mensuales.module').then((m) => m.RUTAS_PAGOS_PERSONAS) },
  { path: 'pagos-mes-personas-detalle', loadChildren: () => import('./pagos-mensuales/pagos-mensuales.module').then((m) => m.RUTAS_PAGOS_PERSONAS_DETALLE) },
  { path: 'prestamos', loadChildren: () => import('./prestamos/prestamos.module').then((m) => m.RUTAS_PRESTAMOS) },
  { path: 'cortes-cobro', loadChildren: () => import('./prestamos/prestamos.module').then((m) => m.RUTAS_CORTES) },
  { path: 'tarjetas', loadChildren: () => import('./tarjetas/tarjetas.module').then((m) => m.RUTAS_TARJETAS) },
  { path: 'extractos', loadChildren: () => import('./extractos/extractos.module').then((m) => m.RUTAS_EXTRACTOS) },
  { path: 'cuentas', loadChildren: () => import('./cuentas/cuentas.module').then((m) => m.RUTAS_CUENTAS) },
  { path: 'categorias', loadChildren: () => import('./cuentas/cuentas.module').then((m) => m.RUTAS_CATEGORIAS) },
  { path: 'transacciones', loadChildren: () => import('./transacciones/transacciones.module').then((m) => m.RUTAS_TRANSACCIONES) },
  { path: 'correos', loadChildren: () => import('./correos/correos.module').then((m) => m.RUTAS_CORREOS) },
  { path: 'flujo-caja', loadChildren: () => import('./flujo-caja/flujo-caja.module').then((m) => m.RUTAS_FLUJO_CAJA) },
  { path: 'estado-cuenta', loadChildren: () => import('./deudas/deudas.module').then((m) => m.RUTAS_ESTADO_CUENTA) },
  { path: 'cruces-deuda', loadChildren: () => import('./deudas/deudas.module').then((m) => m.RUTAS_CRUCES) },
  { path: 'aportes-carro', loadChildren: () => import('./aportes-carro/aportes-carro.module').then((m) => m.RUTAS_APORTES_CARRO) },
  { path: 'liquidacion', loadChildren: () => import('./liquidacion/liquidacion.module').then((m) => m.RUTAS_LIQUIDACION) },
  { path: 'personas', loadChildren: () => import('./personas/personas.module').then((m) => m.RUTAS_PERSONAS) },
  { path: 'cobros', loadChildren: () => import('./cobros/cobros.module').then((m) => m.RUTAS_COBROS) },
  { path: 'recurrentes-persona', loadChildren: () => import('./recurrentes-persona/recurrentes-persona.module').then((m) => m.RUTAS_RECURRENTES) },
  { path: 'obligaciones', loadChildren: () => import('./obligaciones/obligaciones.module').then((m) => m.RUTAS_OBLIGACIONES) },

  // La primera pantalla es el resumen ejecutivo
  { path: '', pathMatch: 'full', loadChildren: () => import('./home/home.module').then((m) => m.RUTAS_HOME) },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PrecargaInteligente })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
