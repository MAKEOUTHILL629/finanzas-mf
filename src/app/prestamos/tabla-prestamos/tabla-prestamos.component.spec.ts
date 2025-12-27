import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TablaPrestamosComponent } from './tabla-prestamos.component';

describe('TablaPrestamosComponent', () => {
  let component: TablaPrestamosComponent;
  let fixture: ComponentFixture<TablaPrestamosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TablaPrestamosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TablaPrestamosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
