import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalleComprasCreditoComponent } from './detalle-compras-credito.component';

describe('DetalleComprasCreditoComponent', () => {
  let component: DetalleComprasCreditoComponent;
  let fixture: ComponentFixture<DetalleComprasCreditoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DetalleComprasCreditoComponent]
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
