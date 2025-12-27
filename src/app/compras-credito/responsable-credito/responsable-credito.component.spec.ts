import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResponsableCreditoComponent } from './responsable-credito.component';

describe('ResponsableCreditoComponent', () => {
  let component: ResponsableCreditoComponent;
  let fixture: ComponentFixture<ResponsableCreditoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ResponsableCreditoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResponsableCreditoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
