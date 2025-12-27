import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PagosMesTarjetasDetalleComponent } from './pagos-mes-tarjetas-detalle.component';

describe('PagosMesTarjetasDetalleComponent', () => {
  let component: PagosMesTarjetasDetalleComponent;
  let fixture: ComponentFixture<PagosMesTarjetasDetalleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PagosMesTarjetasDetalleComponent]
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
