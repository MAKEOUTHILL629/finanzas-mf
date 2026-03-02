import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormularioCsvComprasComponent } from './formulario-csv-compras.component';

describe('FormularioCsvComprasComponent', () => {
  let component: FormularioCsvComprasComponent;
  let fixture: ComponentFixture<FormularioCsvComprasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FormularioCsvComprasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FormularioCsvComprasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
