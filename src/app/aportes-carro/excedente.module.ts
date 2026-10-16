import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { FormularioExcedenteComponent } from './formulario-excedente/formulario-excedente.component';

@NgModule({
  declarations: [FormularioExcedenteComponent],
  imports: [SharedModule],
  exports: [FormularioExcedenteComponent]
})
export class ExcedenteModule {}
