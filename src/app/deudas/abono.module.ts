import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { FormularioAbonoComponent } from './formulario-abono/formulario-abono.component';

@NgModule({
  declarations: [FormularioAbonoComponent],
  imports: [SharedModule],
  exports: [FormularioAbonoComponent]
})
export class AbonoModule {}
