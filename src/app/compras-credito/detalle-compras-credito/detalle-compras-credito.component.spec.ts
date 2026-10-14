import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterModule } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { DetalleComprasCreditoComponent } from './detalle-compras-credito.component';
import { FormatoFechaPipe } from '../../pipes/formato-fecha.pipe';
import { FormatoTarjetaPipe } from '../../pipes/formato-tarjeta.pipe';
import { FormatoPersonaPipe } from '../../pipes/formato-persona.pipe';
import { ApiServicesService } from '../../services/api-services.service';
import { SharedListasService } from '../../services/shared-listas.service';

describe('DetalleComprasCreditoComponent', () => {
  let component: DetalleComprasCreditoComponent;
  let fixture: ComponentFixture<DetalleComprasCreditoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      declarations: [
        DetalleComprasCreditoComponent,
        FormatoFechaPipe,
        FormatoTarjetaPipe,
        FormatoPersonaPipe
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

    fixture = TestBed.createComponent(DetalleComprasCreditoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
