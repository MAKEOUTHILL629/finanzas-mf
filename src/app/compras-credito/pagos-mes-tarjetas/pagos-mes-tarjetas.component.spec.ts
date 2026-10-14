import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterModule } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { PagosMesTarjetasComponent } from './pagos-mes-tarjetas.component';
import { FormatoFechaPipe } from '../../pipes/formato-fecha.pipe';
import { FormatoTarjetaPipe } from '../../pipes/formato-tarjeta.pipe';
import { ApiServicesService } from '../../services/api-services.service';
import { SharedListasService } from '../../services/shared-listas.service';

describe('PagosMesTarjetasComponent', () => {
  let component: PagosMesTarjetasComponent;
  let fixture: ComponentFixture<PagosMesTarjetasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [
        PagosMesTarjetasComponent,
        FormatoFechaPipe,
        FormatoTarjetaPipe
      ],
      providers: [
        ApiServicesService,
        SharedListasService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAnimations(),
        provideCharts(withDefaultRegisterables())
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PagosMesTarjetasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
