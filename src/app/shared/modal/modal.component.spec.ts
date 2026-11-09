import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ModalComponent } from './modal.component';
import { ModalService } from '../../services/modal.service';

@Component({
  template: `<app-modal modalId="prueba" titulo="Prueba"><input id="dentro" /></app-modal>`,
})
class AnfitrionComponent {}

describe('ModalComponent', () => {
  let component: ModalComponent;
  let fixture: ComponentFixture<ModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ModalComponent, AnfitrionComponent],
      providers: [ModalService, provideNoopAnimations()] // sin animación: el diálogo sale del DOM en el acto al cerrarse
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('cierre', () => {
    let anfitrion: ComponentFixture<AnfitrionComponent>;
    let servicio: ModalService;
    const el = () => anfitrion.nativeElement as HTMLElement;

    beforeEach(() => {
      anfitrion = TestBed.createComponent(AnfitrionComponent);
      servicio = TestBed.inject(ModalService);
      servicio.open('prueba');
      anfitrion.detectChanges();
    });

    it('un clic en el fondo (el velo) NO cierra el diálogo', async () => {
      expect(el().querySelector('.modal-content')).not.toBeNull();
      el().querySelector<HTMLElement>('.modal-overlay')!.click();
      anfitrion.detectChanges();
      await anfitrion.whenStable(); // si se hubiera cerrado, aquí ya habría salido del DOM
      expect(el().querySelector('.modal-content')).not.toBeNull();
    });

    it('un clic dentro del diálogo tampoco lo cierra', async () => {
      el().querySelector<HTMLElement>('#dentro')!.click();
      anfitrion.detectChanges();
      await anfitrion.whenStable();
      expect(el().querySelector('.modal-content')).not.toBeNull();
    });

    it('la X cierra el diálogo', async () => {
      el().querySelector<HTMLElement>('.close-button')!.click();
      anfitrion.detectChanges();
      await anfitrion.whenStable(); // la salida (animación) termina en una microtarea
      expect(el().querySelector('.modal-overlay')).toBeNull();
    });

    it('Escape cierra el diálogo', async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      anfitrion.detectChanges();
      await anfitrion.whenStable();
      expect(el().querySelector('.modal-overlay')).toBeNull();
    });
  });
});
