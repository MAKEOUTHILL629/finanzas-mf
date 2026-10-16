import { Component, HostListener, OnDestroy, OnInit, Input } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';
import { ModalService } from '../../services/modal.service';
import { CURVA, duracion } from '../motion';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate(`${duracion(250)} ${CURVA.estandar}`, style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate(`${duracion(200)} ${CURVA.estandar}`, style({ opacity: 0 }))
      ])
    ]),
    // Móvil: la hoja sube con la curva de iOS (sin rebote). Escritorio: el diálogo aparece con un pequeño resorte.
    trigger('slideUp', [
      transition(':enter', [
        style({ transform: '{{ desde }}', opacity: 0.6 }),
        animate(`${duracion(450)} {{ curva }}`, style({ transform: 'translateY(0) scale(1)', opacity: 1 }))
      ], { params: { desde: 'translateY(100%)', curva: CURVA.hoja } }),
      transition(':leave', [
        animate(`${duracion(260)} ${CURVA.estandar}`, style({ transform: 'translateY(100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class ModalComponent implements OnInit, OnDestroy  {

  @Input() modalId: string = 'compra-credito-form'; // ID por defecto para retrocompatibilidad
  /** Nombre accesible del diálogo (lo anuncian los lectores de pantalla). */
  @Input() titulo = 'Formulario';
  isOpen = false;

  /** Cómo entra según el ancho (la hoja inferior del móvil o el diálogo centrado del escritorio). */
  get entrada(): { value: string; params: { desde: string; curva: string } } {
    const escritorio = typeof window !== 'undefined' && window.innerWidth >= 768;
    return { value: '', params: escritorio ? { desde: 'translateY(24px) scale(0.95)', curva: CURVA.resorte } : { desde: 'translateY(100%)', curva: CURVA.hoja } };
  }

  private subscription: Subscription;

  constructor(private modalService: ModalService) {
    this.subscription = new Subscription();
  }
  ngOnInit(): void {
    this.subscription = this.modalService.modalState$.subscribe(
      modalState => {
        this.isOpen = modalState === this.modalId;
      }
    );

  }


  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /** Escape cierra el diálogo abierto, como en cualquier hoja nativa. */
  @HostListener('document:keydown.escape')
  alPulsarEscape(): void {
    if (this.isOpen) this.closeModal();
  }

  closeModal() {
    this.modalService.close();
  }
}
