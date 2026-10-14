import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ResponsableCreditoComponent } from './responsable-credito.component';
import { ApiServicesService } from '../../services/api-services.service';
import { SharedListasService } from '../../services/shared-listas.service';

describe('ResponsableCreditoComponent', () => {
  let component: ResponsableCreditoComponent;
  let fixture: ComponentFixture<ResponsableCreditoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, FormsModule],
      declarations: [ResponsableCreditoComponent],
      providers: [
        ApiServicesService,
        SharedListasService,
        provideHttpClient(),
        provideHttpClientTesting()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResponsableCreditoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
