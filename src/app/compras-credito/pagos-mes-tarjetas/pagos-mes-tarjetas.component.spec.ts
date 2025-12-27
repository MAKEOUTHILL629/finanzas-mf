import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PagosMesTarjetasComponent } from './pagos-mes-tarjetas.component';

describe('PagosMesTarjetasComponent', () => {
  let component: PagosMesTarjetasComponent;
  let fixture: ComponentFixture<PagosMesTarjetasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PagosMesTarjetasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PagosMesTarjetasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
