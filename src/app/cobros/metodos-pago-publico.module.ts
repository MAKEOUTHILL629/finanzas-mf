import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { MetodosPagoPublicoComponent } from './metodos-pago-publico/metodos-pago-publico.component';

/** La tarjeta estilo billetera «¿Dónde puedes pagar?»: la usan el enlace público y la vista previa del propietario. */
@NgModule({
  declarations: [MetodosPagoPublicoComponent],
  imports: [SharedModule],
  exports: [MetodosPagoPublicoComponent],
})
export class MetodosPagoPublicoModule {}
