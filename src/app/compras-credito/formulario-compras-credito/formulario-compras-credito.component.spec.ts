import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormularioComprasCreditoComponent } from './formulario-compras-credito.component';

describe('FormularioComprasCreditoComponent', () => {
  let component: FormularioComprasCreditoComponent;
  let fixture: ComponentFixture<FormularioComprasCreditoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FormularioComprasCreditoComponent]
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
