import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TablaComprasCreditoComponent } from './tabla-compras-credito.component';

describe('TablaComprasCreditoComponent', () => {
  let component: TablaComprasCreditoComponent;
  let fixture: ComponentFixture<TablaComprasCreditoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TablaComprasCreditoComponent]
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
