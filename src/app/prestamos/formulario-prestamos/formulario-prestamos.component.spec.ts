import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormularioPrestamosComponent } from './formulario-prestamos.component';

describe('FormularioPrestamosComponent', () => {
  let component: FormularioPrestamosComponent;
  let fixture: ComponentFixture<FormularioPrestamosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FormularioPrestamosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FormularioPrestamosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
