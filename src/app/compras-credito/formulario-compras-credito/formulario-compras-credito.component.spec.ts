import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormularioComprasCreditoComponent } from './formulario-compras-credito.component';
import { ApiServicesService } from '../../services/api-services.service';
import { ModalService } from '../../services/modal.service';
import { SharedListasService } from '../../services/shared-listas.service';
import { SelectComponent } from '../../shared/ui/select/select.component';

describe('FormularioComprasCreditoComponent', () => {
  let component: FormularioComprasCreditoComponent;
  let fixture: ComponentFixture<FormularioComprasCreditoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        FormsModule,
        MatAutocompleteModule
      ],
      declarations: [FormularioComprasCreditoComponent, SelectComponent],
      providers: [
        ApiServicesService,
        ModalService,
        SharedListasService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAnimations()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FormularioComprasCreditoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
