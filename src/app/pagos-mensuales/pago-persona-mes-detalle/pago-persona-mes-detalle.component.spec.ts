import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PagoPersonaMesDetalleComponent } from './pago-persona-mes-detalle.component';

describe('PagoPersonaMesDetalleComponent', () => {
  let component: PagoPersonaMesDetalleComponent;
  let fixture: ComponentFixture<PagoPersonaMesDetalleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PagoPersonaMesDetalleComponent]
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
