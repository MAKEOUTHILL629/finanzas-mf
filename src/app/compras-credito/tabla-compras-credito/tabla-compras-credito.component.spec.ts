import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TablaComprasCreditoComponent } from './tabla-compras-credito.component';
import { FormatoFechaPipe } from '../../pipes/formato-fecha.pipe';
import { FormatoTarjetaPipe } from '../../pipes/formato-tarjeta.pipe';
import { ApiServicesService } from '../../services/api-services.service';
import { ModalService } from '../../services/modal.service';
import { SharedListasService } from '../../services/shared-listas.service';

describe('TablaComprasCreditoComponent', () => {
  let component: TablaComprasCreditoComponent;
  let fixture: ComponentFixture<TablaComprasCreditoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        FormsModule,
        RouterModule.forRoot([])
      ],
      declarations: [
        TablaComprasCreditoComponent,
        FormatoFechaPipe,
        FormatoTarjetaPipe
      ],
      providers: [
        ApiServicesService,
        ModalService,
        SharedListasService,
        provideHttpClient(),
        provideHttpClientTesting()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TablaComprasCreditoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
