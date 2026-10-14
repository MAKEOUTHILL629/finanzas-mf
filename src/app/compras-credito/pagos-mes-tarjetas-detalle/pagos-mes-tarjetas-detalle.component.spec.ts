import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterModule } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { PagosMesTarjetasDetalleComponent } from './pagos-mes-tarjetas-detalle.component';
import { FormatoFechaPipe } from '../../pipes/formato-fecha.pipe';
import { FormatoTarjetaPipe } from '../../pipes/formato-tarjeta.pipe';
import { ApiServicesService } from '../../services/api-services.service';
import { SharedListasService } from '../../services/shared-listas.service';

describe('PagosMesTarjetasDetalleComponent', () => {
  let component: PagosMesTarjetasDetalleComponent;
  let fixture: ComponentFixture<PagosMesTarjetasDetalleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [
        PagosMesTarjetasDetalleComponent,
        FormatoFechaPipe,
        FormatoTarjetaPipe
      ],
      providers: [
        ApiServicesService,
        SharedListasService,
        DecimalPipe,
        provideHttpClient(),
        provideHttpClientTesting()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PagosMesTarjetasDetalleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
