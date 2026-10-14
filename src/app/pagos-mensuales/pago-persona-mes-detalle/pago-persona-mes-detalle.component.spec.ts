import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterModule } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { PagoPersonaMesDetalleComponent } from './pago-persona-mes-detalle.component';
import { FormatoFechaPipe } from '../../pipes/formato-fecha.pipe';
import { FormatoTarjetaPipe } from '../../pipes/formato-tarjeta.pipe';
import { ApiServicesService } from '../../services/api-services.service';
import { SharedListasService } from '../../services/shared-listas.service';

describe('PagoPersonaMesDetalleComponent', () => {
  let component: PagoPersonaMesDetalleComponent;
  let fixture: ComponentFixture<PagoPersonaMesDetalleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [
        PagoPersonaMesDetalleComponent,
        FormatoFechaPipe,
        FormatoTarjetaPipe
      ],
      providers: [
        ApiServicesService,
        SharedListasService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAnimations()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PagoPersonaMesDetalleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
