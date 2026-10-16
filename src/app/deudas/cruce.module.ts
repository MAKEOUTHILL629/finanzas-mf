import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { FormularioCruceComponent } from './formulario-cruce/formulario-cruce.component';

@NgModule({
  declarations: [FormularioCruceComponent],
  imports: [SharedModule],
  exports: [FormularioCruceComponent]
})
export class CruceModule {}
