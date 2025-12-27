import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PagoPersonaMesComponent } from './pago-persona-mes.component';

describe('PagoPersonaMesComponent', () => {
  let component: PagoPersonaMesComponent;
  let fixture: ComponentFixture<PagoPersonaMesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PagoPersonaMesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PagoPersonaMesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
