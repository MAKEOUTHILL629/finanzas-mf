import { Component, HostListener, OnDestroy, OnInit, Input } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subscription } from 'rxjs';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('250ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0 }))
      ])
    ]),
    // curva de las hojas de iOS: arranca rápido y se asienta con suavidad
    trigger('slideUp', [
      transition(':enter', [
        style({ transform: 'translateY(100%)', opacity: 0.6 }),
        animate('420ms cubic-bezier(0.32, 0.72, 0, 1)', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('260ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateY(100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class ModalComponent implements OnInit, OnDestroy  {

  @Input() modalId: string = 'compra-credito-form'; // ID por defecto para retrocompatibilidad
  /** Nombre accesible del diálogo (lo anuncian los lectores de pantalla). */
  @Input() titulo = 'Formulario';
  isOpen = false;
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
