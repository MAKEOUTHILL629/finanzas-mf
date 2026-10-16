import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { CompartirCobroComponent } from './compartir-cobro/compartir-cobro.component';

@NgModule({
  declarations: [CompartirCobroComponent],
  imports: [SharedModule],
  exports: [CompartirCobroComponent]
})
export class CompartirCobroModule {}
